alter table public.application_events
  drop constraint application_events_actor_profile_id_fkey,
  add constraint application_events_actor_profile_id_fkey
    foreign key (actor_profile_id) references public.profiles(id) on delete set null;

create or replace function public.cleanup_notifications_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.notifications n
  where n.recipient_profile_id <> old.id
    and (
      (n.entity_type in ('player', 'club', 'profile') and n.entity_id = old.id)
      or (n.entity_type = 'application' and n.entity_id in (
            select id from public.applications where player_id = old.id or club_id = old.id))
      or (n.entity_type = 'trial_invite' and n.entity_id in (
            select id from public.trial_invites where player_id = old.id or club_id = old.id))
      or (n.entity_type = 'conversation' and n.entity_id in (
            select id from public.conversations where player_id = old.id or club_id = old.id))
      or (n.entity_type = 'vacancy' and n.entity_id in (
            select id from public.vacancies where club_id = old.id))
    );
  return old;
end $$;

drop trigger if exists cleanup_notifications_before_profile_delete on public.profiles;
create trigger cleanup_notifications_before_profile_delete
  before delete on public.profiles
  for each row execute function public.cleanup_notifications_before_profile_delete();