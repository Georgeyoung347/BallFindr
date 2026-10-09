alter function public.position_label(public.position_code) set search_path = public;
alter function public.vacancy_label(public.position_code[], text) set search_path = public;

revoke all on function public.notify_saved_club_vacancy_insert() from public, anon, authenticated;
revoke all on function public.notify_saved_club_vacancy_update() from public, anon, authenticated;
revoke all on function public.notify_saved_player_availability() from public, anon, authenticated;