REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, account_type, display_name, avatar_path, cover_path, verification_status, created_at, updated_at)
  ON public.profiles TO authenticated;