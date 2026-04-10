export type Money = string;
export type CompanyId = string;
export type UserId = string;
export type AccountId = string;
export type DateString = string;

export type UserRole = 'owner' | 'approver' | 'encoder' | 'viewer' | 'staff';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type EntryStatus = 'draft' | 'posted' | 'void';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type BillStatus = 'draft' | 'approved' | 'partial' | 'paid' | 'cancelled';
export type CompanyTaxType = 'vat' | 'percentage';
export type IndustryPreset = 'retail' | 'trading' | 'services' | 'corporate';
export type ModuleKey =
  | 'dashboard' | 'coa' | 'journal' | 'ar' | 'ap' | 'cash'
  | 'tax' | 'inventory' | 'expenses' | 'reports' | 'budget'
  | 'bank_recon' | 'pos' | 'settings';
export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'gcash' | 'other';

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
