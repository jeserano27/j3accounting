-- ============================================================
-- Migration 005: Accounts Payable
-- Run this AFTER 004_ar.sql
-- ============================================================

-- ── SUPPLIERS ─────────────────────────────────────────────────
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  tin TEXT,
  payment_terms INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company suppliers"
  ON public.suppliers FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage suppliers"
  ON public.suppliers FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── BILLS (AP invoices) ───────────────────────────────────────
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  bill_number TEXT NOT NULL,          -- internal reference
  supplier_ref TEXT,                   -- supplier's own invoice number
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|approved|partial|paid|cancelled
  subtotal NUMERIC(15,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,4) NOT NULL DEFAULT 0,
  balance_due NUMERIC(15,4) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, bill_number)
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company bills"
  ON public.bills FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage bills"
  ON public.bills FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── BILL LINES ────────────────────────────────────────────────
CREATE TABLE public.bill_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),  -- expense account to debit
  line_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bill lines"
  ON public.bill_lines FOR SELECT
  USING (bill_id IN (
    SELECT id FROM public.bills
    WHERE company_id IN (SELECT public.get_user_company_ids())
  ));

CREATE POLICY "Encoders+ can manage bill lines"
  ON public.bill_lines FOR ALL
  USING (bill_id IN (
    SELECT b.id FROM public.bills b
    JOIN public.user_companies uc ON uc.company_id = b.company_id
    WHERE uc.user_id = auth.uid() AND uc.role IN ('owner','approver','encoder')
  ));

-- ── AP PAYMENTS ───────────────────────────────────────────────
CREATE TABLE public.ap_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(15,4) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ap_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ap payments"
  ON public.ap_payments FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage ap payments"
  ON public.ap_payments FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── AUTO-NUMBER BILLS ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_bill_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text || 'bill'));
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.bills
  WHERE company_id = p_company_id
    AND to_char(bill_date, 'YYYY') = v_year;
  RETURN 'BILL-' || v_year || '-' || lpad(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── SYNC BILL AFTER PAYMENT ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_bill_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_bill_id UUID;
  v_total_paid NUMERIC(15,4);
  v_total_amount NUMERIC(15,4);
  v_new_status TEXT;
BEGIN
  v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);

  SELECT
    COALESCE(SUM(p.amount), 0),
    b.total_amount
  INTO v_total_paid, v_total_amount
  FROM public.ap_payments p
  JOIN public.bills b ON b.id = v_bill_id
  WHERE p.bill_id = v_bill_id
  GROUP BY b.total_amount;

  IF v_total_paid IS NULL THEN
    SELECT total_amount INTO v_total_amount FROM public.bills WHERE id = v_bill_id;
    v_total_paid := 0;
  END IF;

  IF v_total_paid >= v_total_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'approved';
  END IF;

  UPDATE public.bills SET
    amount_paid = v_total_paid,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_bill_id AND status NOT IN ('draft', 'cancelled');

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_bill_after_payment_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ap_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_bill_after_payment();
