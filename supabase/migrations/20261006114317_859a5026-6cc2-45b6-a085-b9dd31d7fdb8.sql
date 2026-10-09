
create or replace function private.make_slug(_base text)
returns text language sql volatile set search_path = public as $$
  select coalesce(nullif(trim(both '-' from left(regexp_replace(lower(coalesce(_base,'')), '[^a-z0-9]+', '-', 'g'), 50)), ''), 'ballfindr')
         || '-' || substr(md5(gen_random_uuid()::text), 1, 6)
$$;

alter table public.players add column if not exists slug text;
alter table public.clubs add column if not exists slug text;
alter table public.vacancies add column if not exists slug text;

update public.players p set slug = private.make_slug(pr.display_name) from public.profiles pr where pr.id = p.id and p.slug is null;
update public.players set slug = private.make_slug('player') where slug is null;
update public.clubs set slug = private.make_slug(name) where slug is null;
update public.vacancies v set slug = private.make_slug(coalesce(v.title, 'vacancy') || ' ' || c.name) from public.clubs c where c.id = v.club_id and v.slug is null;
update public.vacancies set slug = private.make_slug('vacancy') where slug is null;

create unique index if not exists players_slug_key on public.players(slug);
create unique index if not exists clubs_slug_key on public.clubs(slug);
create unique index if not exists vacancies_slug_key on public.vacancies(slug);

create or replace function private.assign_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.slug := old.slug;
    if new.slug is not null then return new; end if;
  end if;
  if new.slug is null then
    if tg_table_name = 'players' then
      new.slug := private.make_slug((select display_name from public.profiles where id = new.id));
    elsif tg_table_name = 'clubs' then
      new.slug := private.make_slug(new.name);
    else
      new.slug := private.make_slug(coalesce(new.title, 'vacancy') || ' ' || coalesce((select name from public.clubs where id = new.club_id), ''));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists assign_slug on public.players;
drop trigger if exists assign_slug on public.clubs;
drop trigger if exists assign_slug on public.vacancies;
create trigger assign_slug before insert or update on public.players for each row execute function private.assign_slug();
create trigger assign_slug before insert or update on public.clubs for each row execute function private.assign_slug();
create trigger assign_slug before insert or update on public.vacancies for each row execute function private.assign_slug();

create or replace function private.publicly_listed(_id uuid, _type public.account_type)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = _id and p.account_type = _type and not p.is_hidden)
     and not private.is_restricted(_id)
     and not exists (select 1 from public.user_roles ur where ur.user_id = _id and ur.role = 'admin')
$$;
revoke all on function private.publicly_listed(uuid, public.account_type) from public, anon, authenticated;

create or replace function public.get_public_player(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', pl.id, 'slug', pl.slug, 'name', pr.display_name, 'avatarPath', pr.avatar_path,
    'isVerified', pr.verification_status = 'verified', 'isOwner', pr.is_owner,
    'primaryPosition', pl.primary_position, 'secondaryPositions', coalesce(to_jsonb(pl.secondary_positions), '[]'::jsonb),
    'availability', pl.availability, 'location', pl.location, 'bio', pl.bio, 'lookingFor', pl.looking_for,
    'hasClub', pl.has_club, 'currentClub', case when pl.has_club then pl.current_club_name end,
    'level', (select name from public.levels where id = pl.level_id),
    'preferredLevel', (select name from public.levels where id = pl.preferred_level_id),
    'openToTrials', pl.open_to_trials, 'heightInches', pl.height_inches,
    'history', coalesce((select jsonb_agg(jsonb_build_object('season', h.season, 'club', h.club_name, 'league', h.league,
        'position', h.position, 'appearances', h.appearances, 'goals', h.goals, 'assists', h.assists) order by h.season_start desc)
      from public.player_history h where h.player_id = pl.id), '[]'::jsonb))
  from public.players pl join public.profiles pr on pr.id = pl.id
  where pl.slug = _slug and private.publicly_listed(pl.id, 'player')
$$;

create or replace function private.public_club_json(_club_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'shortName', c.short_name, 'badgePath', c.badge_path,
    'isVerified', pr.verification_status = 'verified', 'isOwner', pr.is_owner, 'isFounderClub', c.is_founder_club,
    'location', c.location, 'league', c.league, 'level', (select name from public.levels where id = c.level_id),
    'description', c.description, 'homeGround', c.home_ground, 'founded', c.founded,
    'trainingDays', coalesce(to_jsonb(c.training_days), '[]'::jsonb), 'matchDay', c.match_day,
    'footballSection', c.football_section)
  from public.clubs c join public.profiles pr on pr.id = c.id
  where c.id = _club_id and private.publicly_listed(c.id, 'club')
$$;
revoke all on function private.public_club_json(uuid) from public, anon, authenticated;

create or replace function private.public_vacancy_json(_v public.vacancies)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', _v.id, 'slug', _v.slug, 'title', _v.title,
    'positions', coalesce(to_jsonb(_v.positions), '[]'::jsonb), 'level', (select name from public.levels where id = _v.level_id),
    'location', _v.location, 'description', _v.description, 'requirements', _v.requirements,
    'trainingDays', coalesce(to_jsonb(_v.training_days), '[]'::jsonb), 'matchDay', _v.match_day,
    'trialsAvailable', _v.trials_available, 'createdAt', _v.created_at,
    'isOpen', _v.status = 'active' and (_v.expires_at is null or _v.expires_at > now()))
$$;
revoke all on function private.public_vacancy_json(public.vacancies) from public, anon, authenticated;

create or replace function public.get_public_club(_slug text)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select private.public_club_json(c.id) || jsonb_build_object('vacancies', coalesce((
      select jsonb_agg(private.public_vacancy_json(v) order by v.created_at desc) from public.vacancies v
      where v.club_id = c.id and v.status = 'active' and (v.expires_at is null or v.expires_at > now())), '[]'::jsonb))
  from public.clubs c where c.slug = _slug and private.publicly_listed(c.id, 'club')
$$;

create or replace function public.get_public_vacancy(_slug text)
returns jsonb language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object('vacancy', private.public_vacancy_json(v), 'club', private.public_club_json(v.club_id))
  from public.vacancies v where v.slug = _slug and private.publicly_listed(v.club_id, 'club')
$$;

revoke all on function public.get_public_player(text), public.get_public_club(text), public.get_public_vacancy(text) from public;
grant execute on function public.get_public_player(text), public.get_public_club(text), public.get_public_vacancy(text) to anon, authenticated, service_role;
