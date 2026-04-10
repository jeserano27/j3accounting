-- ============================================================
-- Migration 002: Chart of Accounts + Seed Data
-- Run this AFTER 001_foundation.sql
-- ============================================================

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,   -- 'asset'|'liability'|'equity'|'revenue'|'expense'
  sub_type TEXT,
  normal_balance TEXT NOT NULL, -- 'debit'|'credit'
  parent_id UUID REFERENCES public.accounts(id),
  level INT DEFAULT 2,
  is_header BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  bir_mapping TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company accounts"
  ON public.accounts FOR SELECT
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Owners/approvers/encoders can manage accounts"
  ON public.accounts FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role IN ('owner','approver','encoder')
  ));

-- ── SEED FUNCTION ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.accounts (company_id, code, name, account_type, sub_type, normal_balance, level, is_header, bir_mapping) VALUES
  -- ASSETS
  (p_company_id,'1000','Assets','asset',NULL,'debit',1,true,NULL),
  (p_company_id,'1010','Cash on Hand','asset','current','debit',2,false,NULL),
  (p_company_id,'1020','Cash in Bank','asset','current','debit',2,false,NULL),
  (p_company_id,'1100','Trade Receivables','asset','current','debit',2,false,NULL),
  (p_company_id,'1110','Allowance for Doubtful Accounts','asset','contra','credit',2,false,NULL),
  (p_company_id,'1200','Inventories','asset','current','debit',2,false,NULL),
  (p_company_id,'1300','Prepaid Expenses','asset','current','debit',2,false,NULL),
  (p_company_id,'1310','Input VAT','asset','tax','debit',2,false,'BIR 2550M/Q'),
  (p_company_id,'1400','Property Plant & Equipment','asset','non-current','debit',2,false,NULL),
  (p_company_id,'1410','Accumulated Depreciation','asset','contra','credit',2,false,NULL),
  (p_company_id,'1500','Intangible Assets','asset','non-current','debit',2,false,NULL),
  (p_company_id,'1600','Other Non-Current Assets','asset','non-current','debit',2,false,NULL),
  -- LIABILITIES
  (p_company_id,'2000','Liabilities','liability',NULL,'credit',1,true,NULL),
  (p_company_id,'2010','Trade Payables','liability','current','credit',2,false,NULL),
  (p_company_id,'2020','Accrued Expenses','liability','current','credit',2,false,NULL),
  (p_company_id,'2100','SSS Payable','liability','current','credit',2,false,NULL),
  (p_company_id,'2110','PhilHealth Payable','liability','current','credit',2,false,NULL),
  (p_company_id,'2120','Pag-IBIG Payable','liability','current','credit',2,false,NULL),
  (p_company_id,'2200','Withholding Tax Payable','liability','current','credit',2,false,'BIR 1601-C/E'),
  (p_company_id,'2210','Output VAT','liability','tax','credit',2,false,'BIR 2550M/Q'),
  (p_company_id,'2300','Income Tax Payable','liability','current','credit',2,false,'BIR 1702-Q'),
  (p_company_id,'2400','Loans Payable','liability','non-current','credit',2,false,NULL),
  -- EQUITY
  (p_company_id,'3000','Equity','equity',NULL,'credit',1,true,NULL),
  (p_company_id,'3010','Share Capital','equity','capital','credit',2,false,NULL),
  (p_company_id,'3020','Additional Paid-in Capital','equity','capital','credit',2,false,NULL),
  (p_company_id,'3030','Retained Earnings','equity','retained','credit',2,false,NULL),
  (p_company_id,'3040','Current Year Net Income','equity','retained','credit',2,false,NULL),
  -- REVENUE
  (p_company_id,'4000','Revenue','revenue',NULL,'credit',1,true,NULL),
  (p_company_id,'4010','Sales Revenue','revenue','operating','credit',2,false,NULL),
  (p_company_id,'4020','Service Income','revenue','operating','credit',2,false,NULL),
  (p_company_id,'4030','Sales Returns & Allowances','revenue','contra','debit',2,false,NULL),
  (p_company_id,'4040','Sales Discounts','revenue','contra','debit',2,false,NULL),
  (p_company_id,'4100','Interest Income','revenue','other','credit',2,false,NULL),
  (p_company_id,'4200','Other Income','revenue','other','credit',2,false,NULL),
  -- COGS
  (p_company_id,'5000','Cost of Goods Sold','expense',NULL,'debit',1,true,NULL),
  (p_company_id,'5010','Cost of Sales','expense','cogs','debit',2,false,NULL),
  (p_company_id,'5020','Freight In','expense','cogs','debit',2,false,NULL),
  (p_company_id,'5030','Purchase Returns','expense','contra','credit',2,false,NULL),
  -- EXPENSES
  (p_company_id,'6000','Operating Expenses','expense',NULL,'debit',1,true,NULL),
  (p_company_id,'6010','Salaries and Wages','expense','operating','debit',2,false,NULL),
  (p_company_id,'6020','SSS Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6030','PhilHealth Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6040','Pag-IBIG Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6050','13th Month Pay','expense','operating','debit',2,false,NULL),
  (p_company_id,'6100','Rent Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6110','Utilities Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6120','Office Supplies','expense','operating','debit',2,false,NULL),
  (p_company_id,'6130','Transportation','expense','operating','debit',2,false,NULL),
  (p_company_id,'6140','Repairs & Maintenance','expense','operating','debit',2,false,NULL),
  (p_company_id,'6150','Professional Fees','expense','operating','debit',2,false,NULL),
  (p_company_id,'6160','Meals & Entertainment','expense','operating','debit',2,false,NULL),
  (p_company_id,'6170','Depreciation Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6180','Insurance Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6190','Taxes & Licenses','expense','operating','debit',2,false,NULL),
  (p_company_id,'6200','Bad Debt Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6210','Miscellaneous Expense','expense','operating','debit',2,false,NULL),
  (p_company_id,'6300','Interest Expense','expense','other','debit',2,false,NULL),
  (p_company_id,'6400','Income Tax Expense','expense','tax','debit',2,false,'BIR 1702-Q'),
  (p_company_id,'6900','Other Expenses','expense','other','debit',2,false,NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-seed COA when company is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
BEGIN
  v_company_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    (NEW.raw_user_meta_data->>'full_name') || '''s Company',
    'My Company'
  );

  INSERT INTO public.companies (name, industry_preset)
  VALUES (
    v_company_name,
    COALESCE(NEW.raw_user_meta_data->>'industry_preset', 'services')
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.user_companies (user_id, company_id, role, is_default)
  VALUES (NEW.id, v_company_id, 'owner', true);

  PERFORM public.seed_chart_of_accounts(v_company_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
