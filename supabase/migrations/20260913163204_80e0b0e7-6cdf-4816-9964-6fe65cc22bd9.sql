create or replace function public.position_label(_p public.position_code)
returns text language sql immutable as $$
  select case _p
    when 'GK' then 'Goalkeeper'
    when 'RB' then 'Right-back'
    when 'CB' then 'Centre-back'
    when 'LB' then 'Left-back'
    when 'CDM' then 'Defensive midfielder'
    when 'CM' then 'Central midfielder'
    when 'CAM' then 'Attacking midfielder'
    when 'RW' then 'Right winger'
    when 'LW' then 'Left winger'
    when 'ST' then 'Striker'
    else null end
$$;

create or replace function public.vacancy_label(_positions public.position_code[], _title text)
returns text language sql immutable as $$
  select coalesce(
    nullif(trim(coalesce(_title, '')), ''),
    public.position_label(_positions[1]),
    'new'
  )
$$;

create or replace function public.notify_saved_club_vacancy_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_club_name text;
begin
  if new.status <> 'active' then return new; end if;
  select name into v_club_name from public.clubs where id = new.club_id;
  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  select sc.player_id, 'saved_club_new_vacancy',
         coalesce(v_club_name, 'A club') || ' has posted a new ' || public.vacancy_label(new.positions, new.title) || ' vacancy.',
         new.location,
         'vacancy', new.id
  from public.saved_clubs sc
  where sc.club_id = new.club_id and sc.player_id <> new.club_id;
  return new;
end $$;

create or replace function public.notify_saved_club_vacancy_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_club_name text;
  v_type text;
  v_title text;
  v_label text;
begin
  select name into v_club_name from public.clubs where id = new.club_id;
  v_label := public.vacancy_label(new.positions, new.title);

  if old.status = 'active' and new.status in ('closed', 'filled', 'expired') then
    v_type := 'saved_club_vacancy_closed';
    v_title := coalesce(v_club_name, 'A club') || ' has closed their ' || v_label || ' vacancy.';
  elsif old.status = 'active' and new.status = 'active' and (
        new.positions is distinct from old.positions
     or new.title is distinct from old.title
     or new.level_id is distinct from old.level_id
     or new.location is distinct from old.location
     or new.training_days is distinct from old.training_days
     or new.match_day is distinct from old.match_day
     or new.description is distinct from old.description
     or new.requirements is distinct from old.requirements
     or new.trials_available is distinct from old.trials_available
     or new.expires_at is distinct from old.expires_at) then
    v_type := 'saved_club_vacancy_updated';
    v_title := coalesce(v_club_name, 'A club') || ' has updated their ' || v_label || ' vacancy.';
  else
    return new;
  end if;

  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  select sc.player_id, v_type, v_title, new.location, 'vacancy', new.id
  from public.saved_clubs sc
  where sc.club_id = new.club_id and sc.player_id <> new.club_id;
  return new;
end $$;

create or replace function public.notify_saved_player_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_title text;
begin
  if new.availability is not distinct from old.availability then return new; end if;
  select display_name into v_name from public.profiles where id = new.id;
  if new.availability = 'open_to_offers' then
    v_title := coalesce(v_name, 'A player') || ' is now open to offers.';
  elsif new.availability = 'actively_looking' then
    v_title := coalesce(v_name, 'A player') || ' is now available immediately.';
  else
    return new;
  end if;

  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  select sp.club_id, 'saved_player_availability', v_title, new.location, 'player', new.id
  from public.saved_players sp
  where sp.player_id = new.id and sp.club_id <> new.id;
  return new;
end $$;

drop trigger if exists notify_saved_club_vacancy_insert on public.vacancies;
create trigger notify_saved_club_vacancy_insert
after insert on public.vacancies
for each row execute function public.notify_saved_club_vacancy_insert();

drop trigger if exists notify_saved_club_vacancy_update on public.vacancies;
create trigger notify_saved_club_vacancy_update
after update on public.vacancies
for each row execute function public.notify_saved_club_vacancy_update();

drop trigger if exists notify_saved_player_availability on public.players;
create trigger notify_saved_player_availability
after update on public.players
for each row execute function public.notify_saved_player_availability();