GRANT EXECUTE ON FUNCTION public.is_admin() TO supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.admin_verification_info(uuid) TO supabase_read_only_user;