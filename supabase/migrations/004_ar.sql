-- ============================================================
-- Migration 004: Accounts Receivable
-- Run this AFTER 003_journal.sql
-- ============================================================

-- ── CUSTOMERS ─────────────────────────────────────────────────
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  tin TEXT,
  payment_terms INT DEFAULT 30,    -- net days
  credit_limit NUMERIC(15,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company customers"
  ON public.customers FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage customers"
  ON public.customers FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── INVOICES ──────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft|sent|partial|paid|overdue|cancelled
  subtotal NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,4) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,4) NOT NULL DEFAULT 0,
  balance_due NUMERIC(15,4) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company invoices"
  ON public.invoices FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage invoices"
  ON public.invoices FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── INVOICE LINES ─────────────────────────────────────────────
CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 12 for VAT, 0 for exempt
  amount NUMERIC(15,4) NOT NULL DEFAULT 0,    -- qty * unit_price * (1 - disc/100)
  line_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice lines"
  ON public.invoice_lines FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM public.invoices
    WHERE company_id IN (SELECT public.get_user_company_ids())
  ));

CREATE POLICY "Encoders+ can manage invoice lines"
  ON public.invoice_lines FOR ALL
  USING (invoice_id IN (
    SELECT inv.id FROM public.invoices inv
    JOIN public.user_companies uc ON uc.company_id = inv.company_id
    WHERE uc.user_id = auth.uid() AND uc.role IN ('owner','approver','encoder')
  ));

-- ── AR PAYMENTS ───────────────────────────────────────────────
CREATE TABLE public.ar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(15,4) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',  -- cash|check|bank_transfer|gcash|other
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ar_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company payments"
  ON public.ar_payments FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage payments"
  ON public.ar_payments FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── AUTO-NUMBER INVOICES ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text || 'inv'));
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.invoices
  WHERE company_id = p_company_id
    AND to_char(invoice_date, 'YYYY') = v_year;
  RETURN 'INV-' || v_year || '-' || lpad(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── UPDATE INVOICE TOTALS & STATUS AFTER PAYMENT ─────────────
CREATE OR REPLACE FUNCTION public.sync_invoice_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total_paid NUMERIC(15,4);
  v_total_amount NUMERIC(15,4);
  v_new_status TEXT;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT
    COALESCE(SUM(p.amount), 0),
    inv.total_amount
  INTO v_total_paid, v_total_amount
  FROM public.ar_payments p
  JOIN public.invoices inv ON inv.id = v_invoice_id
  WHERE p.invoice_id = v_invoice_id
  GROUP BY inv.total_amount;

  IF v_total_paid IS NULL THEN
    SELECT total_amount INTO v_total_amount FROM public.invoices WHERE id = v_invoice_id;
    v_total_paid := 0;
  END IF;

  IF v_total_paid >= v_total_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'sent';
  END IF;

  UPDATE public.invoices SET
    amount_paid = v_total_paid,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_invoice_id AND status NOT IN ('draft', 'cancelled');

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_invoice_after_payment_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ar_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_after_payment();

-- ── OVERDUE UPDATER (call via cron or manually) ───────────────
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE status IN ('sent', 'partial')
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
