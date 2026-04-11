-- ============================================================
-- Migration 006: Invite-Only Access Control
-- Only users with a valid invite code can register.
-- Admin (developer) manages invites via /admin panel.
-- ============================================================

CREATE TABLE public.invites (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT    NOT NULL,
  token       TEXT    NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status      TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'used' | 'revoked'
  note        TEXT,                               -- admin memo (e.g. "from j3forge waitlist")
  invited_by  UUID    REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT now() + interval '30 days',
  used_at     TIMESTAMPTZ,
  used_by     UUID    REFERENCES auth.users(id)
);

-- Public RPC: validate invite token before signup (no auth needed)
CREATE OR REPLACE FUNCTION public.validate_invite(p_email TEXT, p_token TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE LOWER(email) = LOWER(p_email)
      AND token = p_token
      AND status = 'pending'
      AND expires_at > now()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Called by handle_new_user: marks invite as used
CREATE OR REPLACE FUNCTION public.consume_invite(p_email TEXT, p_user_id UUID)
RETURNS VOID AS $$
  UPDATE public.invites
  SET status = 'used', used_at = now(), used_by = p_user_id
  WHERE LOWER(email) = LOWER(p_email) AND status = 'pending';
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Update handle_new_user to check invite ────────────────────
-- This replaces the version from 001 and 002
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
  v_has_invite BOOLEAN;
BEGIN
  -- Check if this email has a valid invite
  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE LOWER(email) = LOWER(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
  ) INTO v_has_invite;

  -- Always create the auth user (Supabase requires it)
  -- But only create company + seed COA if invited
  IF v_has_invite THEN
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

    -- Mark invite as used
    PERFORM public.consume_invite(NEW.email, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger (replaces existing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Only the invite owner (admin) can see/manage their invites
CREATE POLICY "Admin can manage invites"
  ON public.invites FOR ALL
  USING (invited_by = auth.uid());

-- Allow the validate_invite and consume_invite functions to bypass RLS
-- (they use SECURITY DEFINER so they already run as superuser)
