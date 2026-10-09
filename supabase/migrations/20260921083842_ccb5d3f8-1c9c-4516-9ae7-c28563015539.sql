
revoke all on function public.enforce_report_insert() from public, anon, authenticated;
revoke all on function public.enforce_report_update() from public, anon, authenticated;
revoke all on function public.my_restriction() from public, anon;
grant execute on function public.my_restriction() to authenticated, service_role;
