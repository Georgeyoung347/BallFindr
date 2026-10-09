REVOKE EXECUTE ON FUNCTION public.is_admin() FROM supabase_read_only_user;
REVOKE EXECUTE ON FUNCTION public.admin_verification_info(uuid) FROM supabase_read_only_user;