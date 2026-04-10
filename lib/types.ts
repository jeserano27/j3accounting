export type Money = string;

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'gcash' | 'other';
export type CompanyId = string;
export type UserId = string;
export type AccountId = string;
export type DateString = string;

export type UserRole = 'owner' | 'approver' | 'encoder' | 'viewer' | 'staff';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type EntryStatus = 'draft' | 'posted' | 'void';
export type BillStatus = 'draft' | 'approved' | 'partial' | 'paid' | 'cancelled';
export type CompanyTaxType = 'vat' | 'percentage';
export type IndustryPreset = 'retail' | 'trading' | 'services' | 'corporate';
export type ModuleKey =
  | 'dashboard' | 'coa' | 'journal' | 'ar' | 'ap' | 'cash'
  | 'tax' | 'inventory' | 'expenses' | 'reports' | 'budget'
  | 'bank_recon' | 'pos' | 'settings';

export interface Company {
  id: string;
  name: string;
  registered_name: string | null;
  tin: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  fiscal_year_start: number;
  tax_type: CompanyTaxType;
  industry_preset: IndustryPreset;
  rdo_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCompany {
  id: string;
  user_id: string;
  company_id: string;
  role: UserRole;
  is_default: boolean;
  created_at: string;
  company?: Company;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tin: string | null;
  payment_terms: number;
  credit_limit: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  tax_rate: string;
  amount: string;
  line_order: number;
}

export interface ArPayment {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id: string;
  payment_date: string;
  amount: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  sub_type: string | null;
  normal_balance: NormalBalance;
  parent_id: string | null;
  level: number;
  is_header: boolean;
  is_active: boolean;
  description: string | null;
  bir_mapping: string | null;
  created_at: string;
  updated_at: string;
}
