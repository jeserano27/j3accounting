-- ============================================================
-- Migration 003: General Journal
-- Run this AFTER 002_accounts.sql
-- ============================================================

-- ── SEQUENCES ─────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS journal_entry_seq START 1 INCREMENT 1;

-- ── JOURNAL ENTRIES (header) ───────────────────────────────────
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,           -- JE-2024-0001
  entry_date DATE NOT NULL,
  reference TEXT,                        -- e.g. OR #, SI #, check #
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'posted' | 'void'
  created_by UUID REFERENCES auth.users(id),
  posted_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  void_reason TEXT,
  total_debit NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, entry_number)
);

-- ── JOURNAL LINES (detail) ────────────────────────────────────
CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  debit NUMERIC(15,4) NOT NULL DEFAULT 0,
  credit NUMERIC(15,4) NOT NULL DEFAULT 0,
  description TEXT,
  line_order INT NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))  -- a line can't have both
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company journal entries"
  ON public.journal_entries FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Encoders+ can manage journal entries"
  ON public.journal_entries FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

CREATE POLICY "Users can view journal lines via entries"
  ON public.journal_lines FOR SELECT
  USING (entry_id IN (
    SELECT id FROM public.journal_entries
    WHERE company_id IN (SELECT public.get_user_company_ids())
  ));

CREATE POLICY "Encoders+ can manage journal lines"
  ON public.journal_lines FOR ALL
  USING (entry_id IN (
    SELECT je.id FROM public.journal_entries je
    JOIN public.user_companies uc ON uc.company_id = je.company_id
    WHERE uc.user_id = auth.uid() AND uc.role IN ('owner','approver','encoder')
  ));

-- ── BALANCE VERIFICATION TRIGGER ─────────────────────────────
-- Prevent posting an unbalanced entry
CREATE OR REPLACE FUNCTION public.verify_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC(15,4);
  v_total_credit NUMERIC(15,4);
  v_line_count INT;
BEGIN
  -- Only check when posting
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0),
      COUNT(*)
    INTO v_total_debit, v_total_credit, v_line_count
    FROM public.journal_lines
    WHERE entry_id = NEW.id;

    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines.';
    END IF;

    IF v_total_debit = 0 AND v_total_credit = 0 THEN
      RAISE EXCEPTION 'Journal entry has no amounts.';
    END IF;

    IF round(v_total_debit, 4) <> round(v_total_credit, 4) THEN
      RAISE EXCEPTION 'Journal entry is not balanced. Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- Stamp totals
    NEW.total_debit := v_total_debit;
    NEW.total_credit := v_total_credit;
    NEW.posted_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_journal_balance
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.verify_journal_balance();

-- ── AUTO-NUMBER FUNCTION ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_journal_entry_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.journal_entries
  WHERE company_id = p_company_id
    AND to_char(entry_date, 'YYYY') = v_year;

  RETURN 'JE-' || v_year || '-' || lpad(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── UPDATE TOTALS WHEN LINES CHANGE ──────────────────────────
CREATE OR REPLACE FUNCTION public.sync_entry_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);

  UPDATE public.journal_entries SET
    total_debit  = (SELECT COALESCE(SUM(debit),  0) FROM public.journal_lines WHERE entry_id = v_entry_id),
    total_credit = (SELECT COALESCE(SUM(credit), 0) FROM public.journal_lines WHERE entry_id = v_entry_id),
    updated_at   = now()
  WHERE id = v_entry_id AND status = 'draft';

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_entry_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.sync_entry_totals();
