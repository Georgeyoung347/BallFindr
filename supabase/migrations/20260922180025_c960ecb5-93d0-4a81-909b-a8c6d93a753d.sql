-- 1. Section type and columns (existing rows default to mens)
CREATE TYPE public.football_section AS ENUM ('mens', 'womens');

ALTER TABLE public.players
  ADD COLUMN football_section public.football_section NOT NULL DEFAULT 'mens';
ALTER TABLE public.clubs
  ADD COLUMN football_section public.football_section NOT NULL DEFAULT 'mens';

CREATE INDEX IF NOT EXISTS players_football_section_idx ON public.players (football_section);
CREATE INDEX IF NOT EXISTS clubs_football_section_idx ON public.clubs (football_section);

-- 2. Caller's own section, and the shared visibility rule
CREATE OR REPLACE FUNCTION private.my_section()
RETURNS public.football_section
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT p.football_section FROM public.players p WHERE p.id = auth.uid()),
    (SELECT c.football_section FROM public.clubs c WHERE c.id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION private.section_visible(_section public.football_section)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT _section IS NULL
      OR public.is_admin()
      OR private.my_section() IS NULL
      OR private.my_section() = _section
$$;

REVOKE ALL ON FUNCTION private.my_section() FROM public, anon;
REVOKE ALL ON FUNCTION private.section_visible(public.football_section) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.my_section() TO authenticated;
GRANT EXECUTE ON FUNCTION private.section_visible(public.football_section) TO authenticated;

-- 3. Separation enforced in the database (admins exempt via is_admin())
CREATE POLICY "Only same football section players"
ON public.players AS RESTRICTIVE FOR SELECT TO authenticated
USING (auth.uid() = id OR private.section_visible(football_section));

CREATE POLICY "Only same football section clubs"
ON public.clubs AS RESTRICTIVE FOR SELECT TO authenticated
USING (auth.uid() = id OR private.section_visible(football_section));

CREATE POLICY "Only same football section vacancies"
ON public.vacancies AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  auth.uid() = club_id
  OR private.section_visible((SELECT c.football_section FROM public.clubs c WHERE c.id = vacancies.club_id))
);

-- 4. Surface the section on the controlled read views
CREATE OR REPLACE VIEW public.player_cards
WITH (security_invoker = true, security_barrier = true) AS
 SELECT p.id,
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
    l.name AS level_name,
    p.preferred_level_id,
    pl.name AS preferred_level_name,
    p.primary_position,
    p.secondary_positions,
    p.availability,
    p.open_to_trials,
    p.height_inches,
    player_age(p.id) AS age,
    p.created_at,
    p.updated_at,
    p.football_section
   FROM players p
     JOIN profiles pr ON pr.id = p.id
     LEFT JOIN levels l ON l.id = p.level_id
     LEFT JOIN levels pl ON pl.id = p.preferred_level_id
     LEFT JOIN LATERAL player_details(p.id) d(location, bio, looking_for, preferred_training_days, max_travel_miles) ON true
  WHERE auth.uid() IS NOT NULL;

CREATE OR REPLACE VIEW public.club_cards
WITH (security_invoker = true) AS
 SELECT id,
    name,
    short_name,
    badge_path,
    location,
    home_ground,
    league,
    level_id,
    founded,
    description,
    training_days,
    training_location,
    training_time,
    match_day,
    recruitment_status,
    created_at,
    football_section
   FROM clubs c;

-- 5. Signup stores the chosen section
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    insert into public.clubs (id, name, football_section) values (new.id, v_name, v_section);
  else
    insert into public.players (id, football_section) values (new.id, v_section);
    if v_dob is not null then
      insert into public.player_private (player_id, date_of_birth)
      values (new.id, v_dob)
      on conflict (player_id) do update set date_of_birth = excluded.date_of_birth;
    end if;
  end if;
  return new;
end $function$;

-- 6. Section is fixed after signup (only admins may move an account)
CREATE OR REPLACE FUNCTION public.protect_football_section()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.football_section is distinct from old.football_section and not public.is_admin() then
    new.football_section := old.football_section;
  end if;
  return new;
end $$;

REVOKE ALL ON FUNCTION public.protect_football_section() FROM public, anon, authenticated;

CREATE TRIGGER protect_players_football_section
BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.protect_football_section();

CREATE TRIGGER protect_clubs_football_section
BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.protect_football_section();