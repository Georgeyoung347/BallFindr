-- 1. Remove anonymous access everywhere except the public levels list.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind in ('r','v') loop
    execute format('revoke all on public.%I from anon', r.relname);
  end loop;
end $$;
grant select on public.levels to anon;

-- 2. Column-level privacy: table-wide SELECT overrides column grants, so remove it
--    and re-grant only the public-facing columns.
revoke select on public.players from authenticated;
grant select (id, height_inches, location, current_club_name, level_id, primary_position,
  secondary_positions, preferred_level_id, availability, preferred_training_days,
  max_travel_miles, open_to_trials, bio, looking_for, created_at, updated_at)
  on public.players to authenticated;
-- date_of_birth intentionally NOT granted

revoke select on public.clubs from authenticated;
grant select (id, name, short_name, badge_path, team_photo_path, home_ground_photo_path,
  training_pitch_photo_path, location, home_ground, league, level_id, founded, description,
  training_days, training_location, training_time, match_day, recruitment_status,
  created_at, updated_at)
  on public.clubs to authenticated;
-- contact_name / contact_role / contact_email intentionally NOT granted

-- 3. Owner-only access to the private columns (no caller-supplied IDs).
create or replace function public.my_player_private()
returns table (date_of_birth date)
language sql stable security definer set search_path = public
as $$ select p.date_of_birth from public.players p where p.id = auth.uid() $$;
revoke all on function public.my_player_private() from public, anon;
grant execute on function public.my_player_private() to authenticated, service_role;

create or replace function public.my_club_contact()
returns table (contact_name text, contact_role text, contact_email text)
language sql stable security definer set search_path = public
as $$ select c.contact_name, c.contact_role, c.contact_email from public.clubs c where c.id = auth.uid() $$;
revoke all on function public.my_club_contact() from public, anon;
grant execute on function public.my_club_contact() to authenticated, service_role;

-- 4. Age for the safe player_cards view without exposing date_of_birth.
create or replace function public.player_age(_player_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case when p.date_of_birth is null then null
              else date_part('year', age(p.date_of_birth))::int end
  from public.players p
  where p.id = _player_id
    and auth.uid() is not null
    and (auth.uid() = _player_id
         or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.account_type = 'club'))
$$;
revoke all on function public.player_age(uuid) from public, anon;
grant execute on function public.player_age(uuid) to authenticated, service_role;

create or replace view public.player_cards with (security_invoker = true) as
select p.id, pr.display_name, pr.avatar_path, p.location, p.current_club_name, p.level_id,
       p.primary_position, p.secondary_positions, p.preferred_level_id, p.availability,
       p.preferred_training_days, p.max_travel_miles, p.open_to_trials, p.bio, p.looking_for,
       public.player_age(p.id) as age, p.created_at
from public.players p join public.profiles pr on pr.id = p.id;
revoke all on public.player_cards from anon;
revoke all on public.club_cards from anon;

-- 5. Player data readable by the player themselves or by club accounts only.
drop policy if exists "Players are readable by authenticated users" on public.players;
create policy "Players readable by self or club accounts" on public.players
  for select to authenticated
  using (auth.uid() = id or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.account_type = 'club'));

drop policy if exists "Player history is readable by authenticated users" on public.player_history;
create policy "Player history readable by self or club accounts" on public.player_history
  for select to authenticated
  using (auth.uid() = player_id or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.account_type = 'club'));

drop policy if exists "Media is readable by authenticated users" on public.media;
create policy "Media readable by owner or club accounts" on public.media
  for select to authenticated
  using (auth.uid() = owner_profile_id or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.account_type = 'club'));

drop policy if exists "Authenticated users can view player media" on storage.objects;
create policy "Owner or club accounts can view player media" on storage.objects
  for select to authenticated
  using (bucket_id = 'player-media'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.account_type = 'club')));

-- 6. Harden the SECURITY DEFINER helpers that must stay callable from policies/triggers.
create or replace function public.messaging_blocked(_a uuid, _b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is not null and auth.uid() <> _a and auth.uid() <> _b then true
    else exists (
      select 1 from public.message_blocks
      where unblocked_at is null
        and ((blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a)))
  end
$$;

create or replace function public.is_conversation_participant(_conversation_id uuid, _profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not distinct from _profile_id
     and exists (
       select 1 from public.conversations c
       where c.id = _conversation_id and (c.club_id = _profile_id or c.player_id = _profile_id))
$$;

-- 7. Internal trigger / label helpers are not callable directly by app roles.
revoke all on function public.enforce_application_club() from public, anon, authenticated;
revoke all on function public.enforce_conversation_insert() from public, anon, authenticated;
revoke all on function public.enforce_conversation_update() from public, anon, authenticated;
revoke all on function public.enforce_media_write() from public, anon, authenticated;
revoke all on function public.enforce_message_insert() from public, anon, authenticated;
revoke all on function public.enforce_message_update() from public, anon, authenticated;
revoke all on function public.enforce_participant_update() from public, anon, authenticated;
revoke all on function public.enforce_trial_invite_insert() from public, anon, authenticated;
revoke all on function public.enforce_trial_invite_update() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.position_label(position_code) from public, anon, authenticated;
revoke all on function public.vacancy_label(position_code[], text) from public, anon, authenticated;
revoke all on function public.trial_invite_summary(trial_invites) from public, anon, authenticated;
revoke all on function public.has_role(uuid, app_role) from public, anon, authenticated;
revoke all on function public.messaging_blocked(uuid, uuid) from public, anon;
revoke all on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.messaging_blocked(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated, service_role;