create or replace function public.player_details(_player_id uuid)
returns table(
  location text,
  bio text,
  looking_for text,
  preferred_training_days text[],
  max_travel_miles integer
)
language sql stable security definer set search_path = public as $$
  select p.location, p.bio, p.looking_for, p.preferred_training_days, p.max_travel_miles
  from public.players p
  where p.id = _player_id
    and public.can_view_player_details(_player_id)
$$;
revoke execute on function public.player_details(uuid) from public, anon;
grant execute on function public.player_details(uuid) to authenticated;

drop view if exists public.player_cards;

create view public.player_cards with (security_invoker = true, security_barrier = true) as
select
  p.id,
  pr.display_name,
  pr.avatar_path,
  pr.cover_path,
  d.location,
  d.bio,
  d.looking_for,
  d.preferred_training_days,
  d.max_travel_miles,
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
left join lateral public.player_details(p.id) d on true
where auth.uid() is not null;

grant select on public.player_cards to authenticated;