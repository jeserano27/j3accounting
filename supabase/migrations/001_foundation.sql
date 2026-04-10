-- ============================================================
-- Migration 001: Multi-Tenant Foundation
-- Run this in Supabase SQL Editor
-- ============================================================

-- COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registered_name TEXT,
  tin TEXT,
  address TEXT, city TEXT, province TEXT, zip_code TEXT,
  phone TEXT, email TEXT,
  logo_url TEXT,
  fiscal_year_start INT DEFAULT 1,
  tax_type TEXT DEFAULT 'vat',
  industry_preset TEXT DEFAULT 'services',
  rdo_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- USER_COMPANIES
CREATE TABLE public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_role(p_company_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.user_companies WHERE user_id = auth.uid() AND company_id = p_company_id
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- AUTO-CREATE COMPANY ON SIGNUP
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own companies"
  ON public.companies FOR SELECT
  USING (id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Owners can update company"
  ON public.companies FOR UPDATE
  USING (id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "Auth users can create companies"
  ON public.companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own user_companies"
  ON public.user_companies FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owners can manage team"
  ON public.user_companies FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND role = 'owner'
  ));
