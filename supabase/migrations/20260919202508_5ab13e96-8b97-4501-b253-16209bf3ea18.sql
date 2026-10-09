-- 1. Private player details ------------------------------------------------
create table public.player_private (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.player_private to authenticated;
grant all on public.player_private to service_role;

alter table public.player_private enable row level security;

create policy "Players read their own private details"
  on public.player_private for select to authenticated
  using (auth.uid() = player_id);

create policy "Admins read player private details"
  on public.player_private for select to authenticated
  using (public.is_admin());

create policy "Players insert their own private details"
  on public.player_private for insert to authenticated
  with check (auth.uid() = player_id);

create policy "Players update their own private details"
  on public.player_private for update to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create trigger set_player_private_updated_at
  before update on public.player_private
  for each row execute function public.set_updated_at();

insert into public.player_private (player_id, date_of_birth)
select id, date_of_birth from public.players where date_of_birth is not null
on conflict (player_id) do nothing;

-- 2. Read helpers ------------------------------------------------------------
create or replace function public.my_player_private()
returns table(date_of_birth date)
language sql stable security definer set search_path = public as $$
  select pp.date_of_birth from public.player_private pp where pp.player_id = auth.uid()
$$;

create or replace function public.player_age(_player_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select case when pp.date_of_birth is null then null
              else date_part('year', age(pp.date_of_birth))::int end
  from public.player_private pp
  where pp.player_id = _player_id
    and auth.uid() is not null
$$;

create or replace function public.can_view_player_details(_player_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = _player_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.account_type = 'club'
    )
  )
$$;
revoke execute on function public.can_view_player_details(uuid) from public, anon;
grant execute on function public.can_view_player_details(uuid) to authenticated;

-- 3. Remove direct access to the sensitive columns ---------------------------
revoke select (location, bio, looking_for, preferred_training_days, max_travel_miles)
  on public.players from authenticated;

-- 4. Audience-aware player view ---------------------------------------------
drop view if exists public.player_cards;

create view public.player_cards with (security_barrier = true) as
select
  p.id,
  pr.display_name,
  pr.avatar_path,
  pr.cover_path,
  case when public.can_view_player_details(p.id) then p.location end as location,
  case when public.can_view_player_details(p.id) then p.bio end as bio,
  case when public.can_view_player_details(p.id) then p.looking_for end as looking_for,
  case when public.can_view_player_details(p.id) then p.preferred_training_days end as preferred_training_days,
  case when public.can_view_player_details(p.id) then p.max_travel_miles end as max_travel_miles,
  p.current_club_name,
  p.level_id,
  l.name as level_name,
  p.preferred_level_id,
  pl.name as preferred_level_name,
  p.primary_position,
  p.secondary_positions,
  p.availability,
  p.open_to_trials,
  p.height_inches,
  public.player_age(p.id) as age,
  p.created_at,
  p.updated_at
from public.players p
join public.profiles pr on pr.id = p.id
left join public.levels l on l.id = p.level_id
left join public.levels pl on pl.id = p.preferred_level_id
where auth.uid() is not null;

grant select on public.player_cards to authenticated;

-- 5. Drop the now-migrated column -------------------------------------------
alter table public.players drop column date_of_birth;