-- Remove the elevated-permission helper views
drop view if exists public.player_self;
drop view if exists public.club_self;

-- Internal functions must not be callable through the API
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.on_application_insert() from public, anon, authenticated;
revoke all on function public.on_application_stage_change() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_application_club() from public, anon, authenticated;