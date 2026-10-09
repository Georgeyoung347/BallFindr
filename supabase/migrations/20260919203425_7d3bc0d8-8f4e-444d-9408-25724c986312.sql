-- 1) Hide internal verification columns from ordinary authenticated users.
-- Postgres converts the existing table-level SELECT grant into per-column grants,
-- leaving every other profiles column readable exactly as before.
REVOKE SELECT (verification_notes, verification_decided_by, verification_requested_at, verification_decided_at)
  ON public.profiles FROM authenticated;
REVOKE SELECT (verification_notes, verification_decided_by, verification_requested_at, verification_decided_at)
  ON public.profiles FROM anon;

-- 2) Admin-only path to the internal verification details, bound to is_admin().
CREATE OR REPLACE FUNCTION public.admin_verification_info(_profile_id uuid DEFAULT NULL)
RETURNS TABLE(
  profile_id uuid,
  verification_requested_at timestamptz,
  verification_decided_at timestamptz,
  verification_decided_by uuid,
  verification_notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.verification_requested_at, p.verification_decided_at, p.verification_decided_by, p.verification_notes
  FROM public.profiles p
  WHERE public.is_admin()
    AND (_profile_id IS NULL OR p.id = _profile_id);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_verification_info(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_verification_info(uuid) TO authenticated;

-- 3) Logged-out visitors no longer get EXECUTE on the admin check.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;