-- ============================================================
-- Migration 007: Company Team Members
-- Owners can invite registered users to join their company.
-- ============================================================

CREATE TABLE public.company_member_invites (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID  NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invited_by  UUID  NOT NULL REFERENCES auth.users(id),
  email       TEXT  NOT NULL,
  role        TEXT  NOT NULL DEFAULT 'viewer', -- owner|approver|encoder|viewer
  token       TEXT  NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status      TEXT  NOT NULL DEFAULT 'pending', -- pending|accepted|revoked
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT now() + interval '14 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID  REFERENCES auth.users(id)
);

ALTER TABLE public.company_member_invites ENABLE ROW LEVEL SECURITY;

-- Owner can manage their company invites
CREATE POLICY "Owners can manage member invites"
  ON public.company_member_invites FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- Invited user can view invite by token (no auth needed — RPC handles this)
-- Accept invite: logged-in user provides token
CREATE OR REPLACE FUNCTION public.accept_company_invite(p_token TEXT)
RETURNS TEXT AS $$
DECLARE
  v_invite public.company_member_invites;
  v_user_email TEXT;
  v_user_id UUID;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN RETURN 'not_authenticated'; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Find invite
  SELECT * INTO v_invite FROM public.company_member_invites
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN RETURN 'invalid_or_expired'; END IF;

  -- Email must match
  IF LOWER(v_invite.email) != LOWER(v_user_email) THEN RETURN 'email_mismatch'; END IF;

  -- Add to company (upsert: update role if already a member)
  INSERT INTO public.user_companies (user_id, company_id, role, is_default)
  VALUES (v_user_id, v_invite.company_id, v_invite.role, false)
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role;

  -- Mark invite as accepted
  UPDATE public.company_member_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get invite details by token (for the accept page)
CREATE OR REPLACE FUNCTION public.get_company_invite(p_token TEXT)
RETURNS TABLE(
  company_name TEXT,
  invited_email TEXT,
  role TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ
) AS $$
  SELECT
    c.name,
    i.email,
    i.role,
    i.status,
    i.expires_at
  FROM public.company_member_invites i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.token = p_token;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- View: current team members per company
CREATE OR REPLACE VIEW public.company_team AS
  SELECT
    uc.company_id,
    uc.user_id,
    uc.role,
    uc.created_at AS joined_at,
    u.email,
    u.raw_user_meta_data->>'full_name' AS full_name
  FROM public.user_companies uc
  JOIN auth.users u ON u.id = uc.user_id;

-- RLS not needed on view — inherits from user_companies
