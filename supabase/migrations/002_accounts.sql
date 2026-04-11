-- ============================================================
-- Migration 002: Chart of Accounts (Philippines PFRS-Compliant)
-- 3-level hierarchy: Major → Sub-category → Detail accounts
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
  level INT DEFAULT 3,
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

-- ── COMPREHENSIVE PH SEED FUNCTION ────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_company_id UUID)
RETURNS void AS $$
DECLARE
  -- Level 1 IDs
  v_assets UUID; v_liabilities UUID; v_equity UUID;
  v_revenue UUID; v_cos UUID; v_expenses UUID;
  -- Asset sub-categories
  v_current_assets UUID; v_noncurrent_assets UUID;
  v_cash UUID; v_receivables UUID; v_inventories UUID;
  v_prepaid UUID; v_input_vat UUID;
  v_ppe UUID; v_intangibles UUID;
  -- Liability sub-categories
  v_current_liab UUID; v_noncurrent_liab UUID;
  v_payables UUID; v_gov_payables UUID;
  -- Equity sub-categories
  v_paidin UUID; v_retained UUID;
  -- Revenue sub-categories
  v_operating_rev UUID; v_other_income UUID;
  -- Expense sub-categories
  v_personnel UUID; v_occupancy UUID; v_admin UUID;
  v_professional UUID; v_taxes_lic UUID;
  v_financial UUID; v_selling UUID; v_other_exp UUID;
BEGIN

  -- ══ LEVEL 1: MAJOR CATEGORIES ═══════════════════════════════

  INSERT INTO public.accounts (company_id,code,name,account_type,normal_balance,level,is_header)
    VALUES (p_company_id,'1000','Assets','asset','debit',1,true) RETURNING id INTO v_assets;
  INSERT INTO public.accounts (company_id,code,name,account_type,normal_balance,level,is_header)
    VALUES (p_company_id,'2000','Liabilities','liability','credit',1,true) RETURNING id INTO v_liabilities;
  INSERT INTO public.accounts (company_id,code,name,account_type,normal_balance,level,is_header)
    VALUES (p_company_id,'3000','Equity','equity','credit',1,true) RETURNING id INTO v_equity;
  INSERT INTO public.accounts (company_id,code,name,account_type,normal_balance,level,is_header)
    VALUES (p_company_id,'4000','Revenue','revenue','credit',1,true) RETURNING id INTO v_revenue;
  INSERT INTO public.accounts (company_id,code,name,account_type,normal_balance,level,is_header)
    VALUES (p_company_id,'5000','Cost of Sales','expense','debit',1,true) RETURNING id INTO v_cos;
  INSERT INTO public.accounts (company_id,code,name,account_type,normal_balance,level,is_header)
    VALUES (p_company_id,'6000','Operating Expenses','expense','debit',1,true) RETURNING id INTO v_expenses;

  -- ══ LEVEL 2: SUB-CATEGORIES ══════════════════════════════════

  -- Assets
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1100','Current Assets','asset','current','debit',2,true,v_assets) RETURNING id INTO v_current_assets;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1200','Non-Current Assets','asset','non-current','debit',2,true,v_assets) RETURNING id INTO v_noncurrent_assets;

  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1110','Cash and Cash Equivalents','asset','current','debit',2,true,v_current_assets) RETURNING id INTO v_cash;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1130','Trade and Other Receivables','asset','current','debit',2,true,v_current_assets) RETURNING id INTO v_receivables;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1140','Inventories','asset','current','debit',2,true,v_current_assets) RETURNING id INTO v_inventories;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1150','Prepaid Expenses and Other Current Assets','asset','current','debit',2,true,v_current_assets) RETURNING id INTO v_prepaid;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id,bir_mapping)
    VALUES (p_company_id,'1160','Input VAT and Tax Credits','asset','tax','debit',2,true,v_current_assets,'BIR 2550M/Q') RETURNING id INTO v_input_vat;

  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1210','Property, Plant and Equipment','asset','non-current','debit',2,true,v_noncurrent_assets) RETURNING id INTO v_ppe;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'1220','Intangible Assets','asset','non-current','debit',2,true,v_noncurrent_assets) RETURNING id INTO v_intangibles;

  -- Liabilities
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'2100','Current Liabilities','liability','current','credit',2,true,v_liabilities) RETURNING id INTO v_current_liab;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'2200','Non-Current Liabilities','liability','non-current','credit',2,true,v_liabilities) RETURNING id INTO v_noncurrent_liab;

  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'2110','Trade and Other Payables','liability','current','credit',2,true,v_current_liab) RETURNING id INTO v_payables;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'2120','Government Contributions and Taxes Payable','liability','current','credit',2,true,v_current_liab) RETURNING id INTO v_gov_payables;

  -- Equity
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'3100','Paid-in Capital','equity','capital','credit',2,true,v_equity) RETURNING id INTO v_paidin;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'3200','Retained Earnings','equity','retained','credit',2,true,v_equity) RETURNING id INTO v_retained;

  -- Revenue
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'4100','Operating Revenue','revenue','operating','credit',2,true,v_revenue) RETURNING id INTO v_operating_rev;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'4200','Other Income','revenue','other','credit',2,true,v_revenue) RETURNING id INTO v_other_income;

  -- Expenses sub-categories
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6100','Personnel Costs','expense','operating','debit',2,true,v_expenses) RETURNING id INTO v_personnel;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6200','Occupancy Costs','expense','operating','debit',2,true,v_expenses) RETURNING id INTO v_occupancy;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6300','Administrative Expenses','expense','operating','debit',2,true,v_expenses) RETURNING id INTO v_admin;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6400','Professional and Legal Fees','expense','operating','debit',2,true,v_expenses) RETURNING id INTO v_professional;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6500','Taxes and Licenses','expense','operating','debit',2,true,v_expenses) RETURNING id INTO v_taxes_lic;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6600','Financial Charges','expense','other','debit',2,true,v_expenses) RETURNING id INTO v_financial;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6700','Selling and Marketing','expense','operating','debit',2,true,v_expenses) RETURNING id INTO v_selling;
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,is_header,parent_id)
    VALUES (p_company_id,'6800','Other Expenses','expense','other','debit',2,true,v_expenses) RETURNING id INTO v_other_exp;

  -- ══ LEVEL 3: DETAIL ACCOUNTS ═════════════════════════════════

  -- Cash and Cash Equivalents
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'1111','Cash on Hand','asset','current','debit',3,v_cash),
    (p_company_id,'1112','Petty Cash Fund','asset','current','debit',3,v_cash),
    (p_company_id,'1113','Cash in Bank - Checking Account','asset','current','debit',3,v_cash),
    (p_company_id,'1114','Cash in Bank - Savings Account','asset','current','debit',3,v_cash),
    (p_company_id,'1115','Short-term Time Deposits','asset','current','debit',3,v_cash),
    (p_company_id,'1116','Cash Equivalents','asset','current','debit',3,v_cash);

  -- Receivables
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'1131','Accounts Receivable - Trade','asset','current','debit',3,v_receivables),
    (p_company_id,'1132','Notes Receivable','asset','current','debit',3,v_receivables),
    (p_company_id,'1133','Advances to Officers and Employees','asset','current','debit',3,v_receivables),
    (p_company_id,'1134','Advances to Suppliers','asset','current','debit',3,v_receivables),
    (p_company_id,'1135','Other Receivables','asset','current','debit',3,v_receivables),
    (p_company_id,'1136','Allowance for Doubtful Accounts','asset','contra','credit',3,v_receivables);

  -- Inventories
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'1141','Merchandise Inventory','asset','current','debit',3,v_inventories),
    (p_company_id,'1142','Raw Materials Inventory','asset','current','debit',3,v_inventories),
    (p_company_id,'1143','Work in Process Inventory','asset','current','debit',3,v_inventories),
    (p_company_id,'1144','Finished Goods Inventory','asset','current','debit',3,v_inventories),
    (p_company_id,'1145','Supplies Inventory','asset','current','debit',3,v_inventories);

  -- Prepaid
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'1151','Prepaid Rent','asset','current','debit',3,v_prepaid),
    (p_company_id,'1152','Prepaid Insurance','asset','current','debit',3,v_prepaid),
    (p_company_id,'1153','Office Supplies on Hand','asset','current','debit',3,v_prepaid),
    (p_company_id,'1154','Prepaid Taxes and Licenses','asset','current','debit',3,v_prepaid),
    (p_company_id,'1155','Other Prepaid Expenses','asset','current','debit',3,v_prepaid);

  -- Input VAT
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id,bir_mapping) VALUES
    (p_company_id,'1161','Input VAT - Regular Purchases','asset','tax','debit',3,v_input_vat,'BIR 2550M/Q'),
    (p_company_id,'1162','Input VAT - Capital Goods','asset','tax','debit',3,v_input_vat,'BIR 2550M/Q'),
    (p_company_id,'1163','Creditable Withholding Tax (CWT)','asset','tax','debit',3,v_input_vat,'BIR 1606'),
    (p_company_id,'1164','Deferred Input VAT','asset','tax','debit',3,v_input_vat,'BIR 2550M/Q');

  -- PPE
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'1211','Land','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1212','Building','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1213','Leasehold Improvements','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1214','Office Furniture and Fixtures','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1215','Office Equipment','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1216','Computer Equipment and Software','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1217','Transportation Equipment','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1218','Machinery and Equipment','asset','non-current','debit',3,v_ppe),
    (p_company_id,'1219','Accumulated Depreciation - PPE','asset','contra','credit',3,v_ppe);

  -- Intangibles + Other Non-Current
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'1221','Computer Software','asset','non-current','debit',3,v_intangibles),
    (p_company_id,'1222','Goodwill','asset','non-current','debit',3,v_intangibles),
    (p_company_id,'1223','Trademarks and Patents','asset','non-current','debit',3,v_intangibles),
    (p_company_id,'1224','Accumulated Amortization','asset','contra','credit',3,v_intangibles),
    (p_company_id,'1231','Security Deposits','asset','non-current','debit',3,v_noncurrent_assets),
    (p_company_id,'1232','Long-term Investments','asset','non-current','debit',3,v_noncurrent_assets),
    (p_company_id,'1233','Deferred Tax Asset','asset','non-current','debit',3,v_noncurrent_assets),
    (p_company_id,'1234','Other Non-Current Assets','asset','non-current','debit',3,v_noncurrent_assets);

  -- ── Trade and Other Payables
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'2111','Accounts Payable - Trade','liability','current','credit',3,v_payables),
    (p_company_id,'2112','Notes Payable - Current','liability','current','credit',3,v_payables),
    (p_company_id,'2113','Accrued Expenses','liability','current','credit',3,v_payables),
    (p_company_id,'2114','Accrued Salaries and Wages','liability','current','credit',3,v_payables),
    (p_company_id,'2115','Advances from Customers','liability','current','credit',3,v_payables),
    (p_company_id,'2116','Unearned Revenue','liability','current','credit',3,v_payables),
    (p_company_id,'2117','Short-term Bank Loans','liability','current','credit',3,v_current_liab),
    (p_company_id,'2118','Current Portion of Long-term Debt','liability','current','credit',3,v_current_liab);

  -- ── Government Payables
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id,bir_mapping) VALUES
    (p_company_id,'2121','SSS Contributions Payable','liability','current','credit',3,v_gov_payables,NULL),
    (p_company_id,'2122','PhilHealth Contributions Payable','liability','current','credit',3,v_gov_payables,NULL),
    (p_company_id,'2123','Pag-IBIG Contributions Payable','liability','current','credit',3,v_gov_payables,NULL),
    (p_company_id,'2124','Withholding Tax on Compensation Payable','liability','current','credit',3,v_gov_payables,'BIR 1601-C'),
    (p_company_id,'2125','Expanded Withholding Tax (EWT) Payable','liability','current','credit',3,v_gov_payables,'BIR 1601-EQ'),
    (p_company_id,'2126','Output VAT Payable','liability','tax','credit',3,v_gov_payables,'BIR 2550M/Q'),
    (p_company_id,'2127','Percentage Tax Payable','liability','tax','credit',3,v_gov_payables,'BIR 2551Q'),
    (p_company_id,'2128','Income Tax Payable','liability','current','credit',3,v_gov_payables,'BIR 1702-Q'),
    (p_company_id,'2129','Final Withholding Tax Payable','liability','current','credit',3,v_gov_payables,'BIR 1601-FQ');

  -- ── Non-Current Liabilities
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'2211','Bank Loans - Long Term','liability','non-current','credit',3,v_noncurrent_liab),
    (p_company_id,'2212','Finance Lease Payable - Long Term','liability','non-current','credit',3,v_noncurrent_liab),
    (p_company_id,'2213','Deferred Tax Liability','liability','non-current','credit',3,v_noncurrent_liab),
    (p_company_id,'2214','Retirement Benefit Obligation','liability','non-current','credit',3,v_noncurrent_liab);

  -- ── Equity
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'3110','Share Capital - Common','equity','capital','credit',3,v_paidin),
    (p_company_id,'3120','Share Capital - Preferred','equity','capital','credit',3,v_paidin),
    (p_company_id,'3130','Additional Paid-in Capital (Share Premium)','equity','capital','credit',3,v_paidin),
    (p_company_id,'3140','Subscribed Share Capital','equity','capital','credit',3,v_paidin),
    (p_company_id,'3141','Subscription Receivable','equity','contra','debit',3,v_paidin),
    (p_company_id,'3150','Treasury Stock','equity','contra','debit',3,v_paidin);

  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'3210','Retained Earnings - Unappropriated','equity','retained','credit',3,v_retained),
    (p_company_id,'3220','Retained Earnings - Appropriated','equity','retained','credit',3,v_retained),
    (p_company_id,'3230','Current Year Net Income','equity','retained','credit',3,v_retained),
    (p_company_id,'3240','Dividends Declared','equity','contra','debit',3,v_retained);

  -- ── Revenue
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'4110','Sales Revenue','revenue','operating','credit',3,v_operating_rev),
    (p_company_id,'4111','Sales Returns and Allowances','revenue','contra','debit',3,v_operating_rev),
    (p_company_id,'4112','Sales Discounts','revenue','contra','debit',3,v_operating_rev),
    (p_company_id,'4120','Service Income','revenue','operating','credit',3,v_operating_rev),
    (p_company_id,'4130','Professional Fees Earned','revenue','operating','credit',3,v_operating_rev),
    (p_company_id,'4140','Rental Income','revenue','operating','credit',3,v_operating_rev),
    (p_company_id,'4150','Commission Income','revenue','operating','credit',3,v_operating_rev),
    (p_company_id,'4160','Construction Contract Revenue','revenue','operating','credit',3,v_operating_rev);

  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'4210','Interest Income','revenue','other','credit',3,v_other_income),
    (p_company_id,'4220','Dividend Income','revenue','other','credit',3,v_other_income),
    (p_company_id,'4230','Gain on Sale of Assets','revenue','other','credit',3,v_other_income),
    (p_company_id,'4240','Foreign Exchange Gain','revenue','other','credit',3,v_other_income),
    (p_company_id,'4250','Miscellaneous Income','revenue','other','credit',3,v_other_income);

  -- ── Cost of Sales
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'5110','Cost of Sales - Merchandise','expense','cogs','debit',3,v_cos),
    (p_company_id,'5120','Freight In','expense','cogs','debit',3,v_cos),
    (p_company_id,'5130','Purchase Returns and Allowances','expense','contra','credit',3,v_cos),
    (p_company_id,'5140','Purchase Discounts','expense','contra','credit',3,v_cos),
    (p_company_id,'5210','Direct Labor','expense','cogs','debit',3,v_cos),
    (p_company_id,'5220','Direct Materials Used','expense','cogs','debit',3,v_cos),
    (p_company_id,'5230','Subcontractor / Outsourced Services','expense','cogs','debit',3,v_cos),
    (p_company_id,'5240','Factory Overhead','expense','cogs','debit',3,v_cos);

  -- ── Personnel Costs
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6110','Salaries and Wages - Regular','expense','operating','debit',3,v_personnel),
    (p_company_id,'6111','Salaries and Wages - Casual / Contractual','expense','operating','debit',3,v_personnel),
    (p_company_id,'6112','13th Month Pay','expense','operating','debit',3,v_personnel),
    (p_company_id,'6113','Overtime Pay','expense','operating','debit',3,v_personnel),
    (p_company_id,'6114','Holiday and Rest Day Pay','expense','operating','debit',3,v_personnel),
    (p_company_id,'6115','Night Differential','expense','operating','debit',3,v_personnel),
    (p_company_id,'6116','Bonuses and Incentives','expense','operating','debit',3,v_personnel),
    (p_company_id,'6117','SSS - Employer Share','expense','operating','debit',3,v_personnel),
    (p_company_id,'6118','PhilHealth - Employer Share','expense','operating','debit',3,v_personnel),
    (p_company_id,'6119','Pag-IBIG - Employer Share','expense','operating','debit',3,v_personnel),
    (p_company_id,'6120','Retirement Benefit Expense','expense','operating','debit',3,v_personnel),
    (p_company_id,'6121','Employees'' Welfare and Benefits','expense','operating','debit',3,v_personnel),
    (p_company_id,'6122','Training and Seminars','expense','operating','debit',3,v_personnel);

  -- ── Occupancy Costs
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6210','Rent Expense','expense','operating','debit',3,v_occupancy),
    (p_company_id,'6211','Electricity Expense','expense','operating','debit',3,v_occupancy),
    (p_company_id,'6212','Water Expense','expense','operating','debit',3,v_occupancy),
    (p_company_id,'6213','Internet and Telecommunications','expense','operating','debit',3,v_occupancy),
    (p_company_id,'6214','Repairs and Maintenance','expense','operating','debit',3,v_occupancy),
    (p_company_id,'6215','Janitorial and Security Services','expense','operating','debit',3,v_occupancy),
    (p_company_id,'6216','Condominium Association Dues','expense','operating','debit',3,v_occupancy);

  -- ── Administrative
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6310','Office Supplies Expense','expense','operating','debit',3,v_admin),
    (p_company_id,'6311','Printing and Reproduction','expense','operating','debit',3,v_admin),
    (p_company_id,'6312','Postage and Courier','expense','operating','debit',3,v_admin),
    (p_company_id,'6313','Transportation and Travel - Local','expense','operating','debit',3,v_admin),
    (p_company_id,'6314','Transportation and Travel - Foreign','expense','operating','debit',3,v_admin),
    (p_company_id,'6315','Representation and Entertainment','expense','operating','debit',3,v_admin),
    (p_company_id,'6316','Depreciation Expense','expense','operating','debit',3,v_admin),
    (p_company_id,'6317','Amortization Expense','expense','operating','debit',3,v_admin),
    (p_company_id,'6318','Insurance Expense','expense','operating','debit',3,v_admin),
    (p_company_id,'6319','Subscription and Dues','expense','operating','debit',3,v_admin),
    (p_company_id,'6320','Donation and Contribution','expense','operating','debit',3,v_admin);

  -- ── Professional Fees
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6410','Audit and Accounting Fees','expense','operating','debit',3,v_professional),
    (p_company_id,'6411','Legal Fees','expense','operating','debit',3,v_professional),
    (p_company_id,'6412','Consultancy Fees','expense','operating','debit',3,v_professional),
    (p_company_id,'6413','Management Fees','expense','operating','debit',3,v_professional),
    (p_company_id,'6414','IT and Technical Services','expense','operating','debit',3,v_professional);

  -- ── Taxes and Licenses
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id,bir_mapping) VALUES
    (p_company_id,'6510','Business Permits and Licenses','expense','operating','debit',3,v_taxes_lic,NULL),
    (p_company_id,'6511','Documentary Stamp Tax','expense','operating','debit',3,v_taxes_lic,'BIR 2000'),
    (p_company_id,'6512','Real Property Tax','expense','operating','debit',3,v_taxes_lic,NULL),
    (p_company_id,'6513','Income Tax Expense','expense','tax','debit',3,v_taxes_lic,'BIR 1702-RT'),
    (p_company_id,'6514','Percentage Tax Expense','expense','tax','debit',3,v_taxes_lic,'BIR 2551Q'),
    (p_company_id,'6515','Other Taxes and Government Fees','expense','operating','debit',3,v_taxes_lic,NULL);

  -- ── Financial Charges
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6610','Interest Expense','expense','other','debit',3,v_financial),
    (p_company_id,'6611','Bank Charges and Fees','expense','other','debit',3,v_financial),
    (p_company_id,'6612','Foreign Exchange Loss','expense','other','debit',3,v_financial),
    (p_company_id,'6613','Finance Lease Interest','expense','other','debit',3,v_financial);

  -- ── Selling and Marketing
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6710','Advertising and Promotions','expense','operating','debit',3,v_selling),
    (p_company_id,'6711','Sales Commission Expense','expense','operating','debit',3,v_selling),
    (p_company_id,'6712','Delivery and Freight Out','expense','operating','debit',3,v_selling),
    (p_company_id,'6713','Marketing Materials and Events','expense','operating','debit',3,v_selling),
    (p_company_id,'6714','After-Sales Service Costs','expense','operating','debit',3,v_selling);

  -- ── Other Expenses
  INSERT INTO public.accounts (company_id,code,name,account_type,sub_type,normal_balance,level,parent_id) VALUES
    (p_company_id,'6810','Bad Debt Expense','expense','other','debit',3,v_other_exp),
    (p_company_id,'6811','Loss on Sale / Disposal of Assets','expense','other','debit',3,v_other_exp),
    (p_company_id,'6812','Impairment Loss','expense','other','debit',3,v_other_exp),
    (p_company_id,'6813','Miscellaneous Expense','expense','other','debit',3,v_other_exp);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-seed COA when new user signs up
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
  VALUES (v_company_name, COALESCE(NEW.raw_user_meta_data->>'industry_preset', 'services'))
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
