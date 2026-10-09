
-- 1. Clubs gain an active section; players can never be 'both'.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS active_section public.football_section NOT NULL DEFAULT 'mens';

ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_active_section_single;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_active_section_single CHECK (active_section IN ('mens','womens'));

UPDATE public.clubs SET active_section = football_section WHERE football_section <> 'both';

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_section_single;
ALTER TABLE public.players
  ADD CONSTRAINT players_section_single CHECK (football_section IN ('mens','womens'));

GRANT SELECT (active_section), UPDATE (active_section, football_section) ON public.clubs TO authenticated;

-- 2. Vacancies carry their own section.
ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS football_section public.football_section NOT NULL DEFAULT 'mens';
ALTER TABLE public.vacancies
  DROP CONSTRAINT IF EXISTS vacancies_section_single;
ALTER TABLE public.vacancies
  ADD CONSTRAINT vacancies_section_single CHECK (football_section IN ('mens','womens'));

UPDATE public.vacancies v
   SET football_section = c.football_section
  FROM public.clubs c
 WHERE c.id = v.club_id AND c.football_section <> 'both';

GRANT SELECT (football_section) ON public.vacancies TO authenticated;
CREATE INDEX IF NOT EXISTS vacancies_football_section_idx ON public.vacancies (football_section);
CREATE INDEX IF NOT EXISTS clubs_active_section_idx ON public.clubs (active_section);

-- 3. Helper functions.
CREATE OR REPLACE FUNCTION private.my_section()
RETURNS public.football_section
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT p.football_section FROM public.players p WHERE p.id = auth.uid()),
    (SELECT c.active_section FROM public.clubs c WHERE c.id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION private.section_visible(_section public.football_section)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private'
AS $$
  SELECT _section IS NULL
      OR _section = 'both'
      OR public.is_admin()
      OR private.my_section() IS NULL
      OR private.my_section() = _section
$$;

CREATE OR REPLACE FUNCTION private.player_section(_player_id uuid)
RETURNS public.football_section
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT p.football_section FROM public.players p WHERE p.id = _player_id $$;

CREATE OR REPLACE FUNCTION private.vacancy_section(_vacancy_id uuid)
RETURNS public.football_section
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT v.football_section FROM public.vacancies v WHERE v.id = _vacancy_id $$;

REVOKE EXECUTE ON FUNCTION private.my_section(), private.section_visible(public.football_section),
  private.player_section(uuid), private.vacancy_section(uuid) FROM anon;

-- 4. Section policies.
DROP POLICY IF EXISTS "Only same football section vacancies" ON public.vacancies;
CREATE POLICY "Only same football section vacancies" ON public.vacancies
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() = club_id OR private.section_visible(football_section));

DROP POLICY IF EXISTS "Only same football section applications" ON public.applications;
CREATE POLICY "Only same football section applications" ON public.applications
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() = player_id OR private.section_visible(private.vacancy_section(vacancy_id)));

DROP POLICY IF EXISTS "Only same football section saved players" ON public.saved_players;
CREATE POLICY "Only same football section saved players" ON public.saved_players
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() = player_id OR private.section_visible(private.player_section(player_id)));

-- 5. Section changes: clubs may change their own, players may not.
DROP TRIGGER IF EXISTS protect_football_section_clubs ON public.clubs;
DROP TRIGGER IF EXISTS protect_football_section ON public.clubs;

CREATE OR REPLACE FUNCTION public.enforce_club_section()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if TG_OP = 'UPDATE'
     and new.football_section is distinct from old.football_section
     and not (public.is_admin() or auth.uid() = new.id) then
    new.football_section := old.football_section;
  end if;
  if new.football_section <> 'both' then
    new.active_section := new.football_section;
  elsif new.active_section not in ('mens','womens') then
    new.active_section := 'mens';
  end if;
  return new;
end $$;

REVOKE EXECUTE ON FUNCTION public.enforce_club_section() FROM public, anon, authenticated;

CREATE TRIGGER enforce_club_section
  BEFORE INSERT OR UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_section();

-- 6. New vacancies inherit the club's operating section.
CREATE OR REPLACE FUNCTION public.set_vacancy_section()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v_section public.football_section;
begin
  select case when c.football_section = 'both' then c.active_section else c.football_section end
    into v_section from public.clubs c where c.id = new.club_id;
  new.football_section := coalesce(v_section, 'mens');
  return new;
end $$;

REVOKE EXECUTE ON FUNCTION public.set_vacancy_section() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS set_vacancy_section ON public.vacancies;
CREATE TRIGGER set_vacancy_section
  BEFORE INSERT ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.set_vacancy_section();

-- 7. Signup: clubs may pick 'both'; players are forced to one section.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_type text;
  v_name text;
  v_dob date;
  v_section public.football_section;
begin
  v_type := coalesce(new.raw_user_meta_data->>'account_type', 'player');
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1));

  begin
    v_dob := nullif(btrim(coalesce(new.raw_user_meta_data->>'date_of_birth', '')), '')::date;
  exception when others then
    v_dob := null;
  end;

  begin
    v_section := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'football_section', '')), ''), 'mens')::public.football_section;
  exception when others then
    v_section := 'mens';
  end;

  if v_dob is not null and v_dob > (current_date - interval '16 years') then
    raise exception 'You must be 16 or over to use BallFindr';
  end if;

  insert into public.profiles (id, account_type, display_name)
  values (new.id, v_type::public.account_type, v_name);

  if v_type = 'club' then
    insert into public.clubs (id, name, football_section, active_section)
    values (new.id, v_name, v_section, case when v_section = 'both' then 'mens' else v_section end);
  else
    if v_section = 'both' then v_section := 'mens'; end if;
    insert into public.players (id, football_section) values (new.id, v_section);
    if v_dob is not null then
      insert into public.player_private (player_id, date_of_birth)
      values (new.id, v_dob)
      on conflict (player_id) do update set date_of_birth = excluded.date_of_birth;
    end if;
  end if;
  return new;
end $$;

-- 8. Conversations may only start within one section.
CREATE OR REPLACE FUNCTION public.enforce_conversation_insert()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null or auth.uid() <> new.club_id then
    raise exception 'Only a club can start a conversation, and only as itself';
  end if;
  if not exists (select 1 from public.profiles where id = new.club_id and account_type = 'club') then
    raise exception 'Only club accounts can start conversations';
  end if;
  if not exists (select 1 from public.players where id = new.player_id) then
    raise exception 'Player not found';
  end if;
  if not exists (
    select 1 from public.clubs c, public.players p
     where c.id = new.club_id and p.id = new.player_id
       and case when c.football_section = 'both' then c.active_section else c.football_section end = p.football_section
  ) then
    raise exception 'You can only message players in the football section you are operating in';
  end if;
  if private.is_restricted(new.club_id) or private.is_restricted(new.player_id) then
    raise exception 'You cannot message this player';
  end if;
  if public.messaging_blocked(new.club_id, new.player_id) then
    raise exception 'You cannot message this player';
  end if;
  new.status := 'active';
  new.paused_by := null; new.paused_at := null;
  new.blocked_by := null; new.blocked_at := null;
  new.last_message_at := null; new.last_message_preview := null; new.last_message_sender_id := null;
  new.created_at := now(); new.updated_at := now();
  return new;
end $$;
