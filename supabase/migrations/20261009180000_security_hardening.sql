-- Security hardening (audit findings M1, L1, L2, L3, L4, L5).
--
-- Every section names the finding it fixes. The migration is written to be
-- re-runnable: functions use CREATE OR REPLACE, and every policy and trigger is
-- dropped (IF EXISTS) before it is created.

-- ============================================================================
-- M1. Image paths on profiles and clubs must point into the row owner's folder
-- ============================================================================
-- profiles.avatar_path / cover_path and clubs.badge_path / team_photo_path /
-- home_ground_photo_path / training_pitch_photo_path were free text. A member
-- could store another member's object name (or '../x', or an http(s) URL),
-- which the storage SELECT policy and the service-role share image code then
-- honoured.
--
-- The upload code (src/lib/profile-images.ts) always writes
--   '<auth uid>/<slot>-<timestamp>.<jpg|png|webp>'
-- into the profile-images bucket, and storage INSERT is limited to the caller's
-- own '<auth uid>/' folder. A club row's id is its owner's profile id, so the
-- owner folder of every row is the row's own id.
--
-- A trigger (not a CHECK constraint) is used so a legacy value on an existing
-- row does not block unrelated updates to that row: values are only checked on
-- INSERT and when the image column itself changes. NULL is always allowed (the
-- "remove photo" flow and admin_switch_account_type write NULL).
--
-- Writes with no signed-in user (auth.uid() IS NULL: service role, SQL console,
-- migrations, auth.users signup trigger) are not checked. No server code writes
-- image paths for another member today; the admin profile editor whitelists
-- columns and never touches them.

CREATE OR REPLACE FUNCTION private.image_path_ok(_owner uuid, _path text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT _path IS NULL OR (
    _owner IS NOT NULL
    AND position('..' IN _path) = 0
    AND _path ~ ('^' || _owner::text || '/[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$')
    AND lower(_path) ~ '\.(jpe?g|png|webp)$'
  )
$$;
REVOKE ALL ON FUNCTION private.image_path_ok(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.image_path_ok(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.enforce_profile_image_paths()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.avatar_path IS DISTINCT FROM OLD.avatar_path)
     AND NOT private.image_path_ok(NEW.id, NEW.avatar_path) THEN
    RAISE EXCEPTION 'Invalid image path for avatar_path' USING ERRCODE = '22023';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.cover_path IS DISTINCT FROM OLD.cover_path)
     AND NOT private.image_path_ok(NEW.id, NEW.cover_path) THEN
    RAISE EXCEPTION 'Invalid image path for cover_path' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.enforce_profile_image_paths() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_club_image_paths()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.badge_path IS DISTINCT FROM OLD.badge_path)
     AND NOT private.image_path_ok(NEW.id, NEW.badge_path) THEN
    RAISE EXCEPTION 'Invalid image path for badge_path' USING ERRCODE = '22023';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.team_photo_path IS DISTINCT FROM OLD.team_photo_path)
     AND NOT private.image_path_ok(NEW.id, NEW.team_photo_path) THEN
    RAISE EXCEPTION 'Invalid image path for team_photo_path' USING ERRCODE = '22023';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.home_ground_photo_path IS DISTINCT FROM OLD.home_ground_photo_path)
     AND NOT private.image_path_ok(NEW.id, NEW.home_ground_photo_path) THEN
    RAISE EXCEPTION 'Invalid image path for home_ground_photo_path' USING ERRCODE = '22023';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.training_pitch_photo_path IS DISTINCT FROM OLD.training_pitch_photo_path)
     AND NOT private.image_path_ok(NEW.id, NEW.training_pitch_photo_path) THEN
    RAISE EXCEPTION 'Invalid image path for training_pitch_photo_path' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.enforce_club_image_paths() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_profile_image_paths ON public.profiles;
CREATE TRIGGER enforce_profile_image_paths
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.enforce_profile_image_paths();

DROP TRIGGER IF EXISTS enforce_club_image_paths ON public.clubs;
CREATE TRIGGER enforce_club_image_paths
  BEFORE INSERT OR UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION private.enforce_club_image_paths();

-- Defence in depth for rows that already hold a foreign path: a profile/club
-- only makes an object readable when the object sits in that row's own folder.
-- Otherwise identical to the policy from 20260922175133.
DROP POLICY IF EXISTS "Profile images readable when in use or owned" ON storage.objects;
CREATE POLICY "Profile images readable when in use or owned"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.avatar_path = objects.name OR p.cover_path = objects.name)
        AND (storage.foldername(objects.name))[1] = p.id::text
        AND private.account_visible(p.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE (
          c.badge_path = objects.name
          OR c.team_photo_path = objects.name
          OR c.home_ground_photo_path = objects.name
          OR c.training_pitch_photo_path = objects.name
        )
        AND (storage.foldername(objects.name))[1] = c.id::text
        AND private.account_visible(c.id)
        AND private.can_view_club(c.id)
    )
  )
);

-- The public share lookups hand avatarPath / badgePath to server code that
-- reads storage with the service role. Only return a path that sits in the
-- owner's own folder, so a legacy foreign or '../' value is never handed out.
-- Bodies are otherwise unchanged from 20261007090001 / 20261006114317.
CREATE OR REPLACE FUNCTION public.get_public_player(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'slug', pl.slug, 'name', pr.display_name,
    'avatarPath', case when private.image_path_ok(pl.id, pr.avatar_path) then pr.avatar_path end,
    'isVerified', pr.verification_status = 'verified', 'isOwner', pr.is_owner,
    'primaryPosition', pl.primary_position, 'secondaryPositions', coalesce(to_jsonb(pl.secondary_positions), '[]'::jsonb),
    'availability', pl.availability,
    'level', (select name from public.levels where id = pl.level_id),
    'preferredLevel', (select name from public.levels where id = pl.preferred_level_id),
    'openToTrials', pl.open_to_trials)
  from public.players pl join public.profiles pr on pr.id = pl.id
  where pl.slug = _slug and private.publicly_listed(pl.id, 'player')
$function$;

CREATE OR REPLACE FUNCTION private.public_club_json(_club_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'shortName', c.short_name,
    'badgePath', case when private.image_path_ok(c.id, c.badge_path) then c.badge_path end,
    'isVerified', pr.verification_status = 'verified', 'isOwner', pr.is_owner, 'isFounderClub', c.is_founder_club,
    'location', c.location, 'league', c.league, 'level', (select name from public.levels where id = c.level_id),
    'description', c.description, 'homeGround', c.home_ground, 'founded', c.founded,
    'trainingDays', coalesce(to_jsonb(c.training_days), '[]'::jsonb), 'matchDay', c.match_day,
    'footballSection', c.football_section)
  from public.clubs c join public.profiles pr on pr.id = c.id
  where c.id = _club_id and private.publicly_listed(c.id, 'club')
$function$;
REVOKE ALL ON FUNCTION private.public_club_json(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- L2. Moderator "hide profile" is enforced in the database
-- ============================================================================
-- profiles.is_hidden was only filtered client-side (discover-players.ts,
-- discover-clubs.ts). The admin UI describes hiding as "Hide this profile from
-- public discovery? The account is not banned and can still sign in and use
-- BallFindr." So a hidden account stays fully usable by its owner and by the
-- people it already deals with; everyone else stops seeing it.
--
-- A hidden account (and its player/club record, vacancies, media, history,
-- achievements and saved-list entries pointing at it) is visible only to:
--   * the account itself,
--   * administrators and moderators (public.can_moderate()),
--   * accounts with a direct relationship to it: an existing conversation,
--     application or trial invite between the two.
-- These are RESTRICTIVE policies, so they only narrow what the existing
-- policies (restriction, section, admin-club rules) already allow.

CREATE OR REPLACE FUNCTION private.hidden_account_visible(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT _profile_id IS NULL
      OR auth.uid() = _profile_id
      OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _profile_id AND p.is_hidden)
      OR public.can_moderate()
      OR (auth.uid() IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.conversations c
                    WHERE (c.player_id = _profile_id AND c.club_id = auth.uid())
                       OR (c.club_id = _profile_id AND c.player_id = auth.uid()))
         OR EXISTS (SELECT 1 FROM public.applications a
                    WHERE (a.player_id = _profile_id AND a.club_id = auth.uid())
                       OR (a.club_id = _profile_id AND a.player_id = auth.uid()))
         OR EXISTS (SELECT 1 FROM public.trial_invites t
                    WHERE (t.player_id = _profile_id AND t.club_id = auth.uid())
                       OR (t.club_id = _profile_id AND t.player_id = auth.uid()))
      ))
$$;
REVOKE ALL ON FUNCTION private.hidden_account_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.hidden_account_visible(uuid) TO authenticated, service_role;

-- profiles reads its own column first so the helper's lookup is skipped for
-- every visible row.
DROP POLICY IF EXISTS "Hide hidden accounts" ON public.profiles;
CREATE POLICY "Hide hidden accounts" ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT is_hidden OR private.hidden_account_visible(id));

DROP POLICY IF EXISTS "Hide hidden players" ON public.players;
CREATE POLICY "Hide hidden players" ON public.players
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(id));

DROP POLICY IF EXISTS "Hide hidden clubs" ON public.clubs;
CREATE POLICY "Hide hidden clubs" ON public.clubs
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(id));

DROP POLICY IF EXISTS "Hide hidden club vacancies" ON public.vacancies;
CREATE POLICY "Hide hidden club vacancies" ON public.vacancies
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(club_id));

DROP POLICY IF EXISTS "Hide hidden account media" ON public.media;
CREATE POLICY "Hide hidden account media" ON public.media
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(owner_profile_id));

DROP POLICY IF EXISTS "Hide hidden player history" ON public.player_history;
CREATE POLICY "Hide hidden player history" ON public.player_history
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(player_id));

DROP POLICY IF EXISTS "Hide hidden account achievements" ON public.achievements;
CREATE POLICY "Hide hidden account achievements" ON public.achievements
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(profile_id));

DROP POLICY IF EXISTS "Hide hidden club history" ON public.club_history;
CREATE POLICY "Hide hidden club history" ON public.club_history
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(club_id));

-- Saved lists: drop entries for a hidden target the saver has no relationship
-- with (mirrors the restricted-account rule; the row returns on unhide).
DROP POLICY IF EXISTS "Hide hidden saved players" ON public.saved_players;
CREATE POLICY "Hide hidden saved players" ON public.saved_players
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(player_id));

DROP POLICY IF EXISTS "Hide hidden saved clubs" ON public.saved_clubs;
CREATE POLICY "Hide hidden saved clubs" ON public.saved_clubs
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.hidden_account_visible(club_id));

DROP POLICY IF EXISTS "Hide hidden club saved vacancies" ON public.saved_vacancies;
CREATE POLICY "Hide hidden club saved vacancies" ON public.saved_vacancies
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vacancies v
    WHERE v.id = saved_vacancies.vacancy_id
      AND private.hidden_account_visible(v.club_id)
  ));

-- ============================================================================
-- L1. player_age() and player_details() respect player visibility
-- ============================================================================
-- Both are SECURITY DEFINER and previously answered for any player id, even a
-- restricted, hidden or other-section player the caller cannot read. The gate
-- mirrors the SELECT policies on public.players. Self and moderators/admins are
-- always allowed. Who counts as a club for player_details is unchanged
-- (public.can_view_player_details).

CREATE OR REPLACE FUNCTION private.player_visible(_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = _player_id
    OR public.can_moderate()
    OR (
      private.profile_is_type(_player_id, 'player'::public.account_type)
      AND private.account_visible(_player_id)
      AND private.section_visible(private.player_section(_player_id))
      AND private.hidden_account_visible(_player_id)
    )
  )
$$;
REVOKE ALL ON FUNCTION private.player_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.player_visible(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.player_age(_player_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select case when pp.date_of_birth is null then null
              else date_part('year', age(pp.date_of_birth))::int end
  from public.player_private pp
  where pp.player_id = _player_id
    and auth.uid() is not null
    and private.player_visible(_player_id)
$$;
REVOKE ALL ON FUNCTION public.player_age(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_age(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.player_details(_player_id uuid)
RETURNS TABLE(location text, bio text, looking_for text, preferred_training_days text[], max_travel_miles integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select p.location, p.bio, p.looking_for, p.preferred_training_days, p.max_travel_miles
  from public.players p
  where p.id = _player_id
    and public.can_view_player_details(_player_id)
    and private.player_visible(_player_id)
$$;
REVOKE ALL ON FUNCTION public.player_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_details(uuid) TO authenticated, service_role;

-- ============================================================================
-- L3. Restricted accounts cannot react to media
-- ============================================================================
-- media_reactions was created after the "Restricted accounts cannot ..." loop
-- in 20260921083816, so it never got those restrictive policies.
DROP POLICY IF EXISTS "Restricted accounts cannot insert" ON public.media_reactions;
CREATE POLICY "Restricted accounts cannot insert" ON public.media_reactions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.actor_unrestricted());

DROP POLICY IF EXISTS "Restricted accounts cannot update" ON public.media_reactions;
CREATE POLICY "Restricted accounts cannot update" ON public.media_reactions
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (private.actor_unrestricted())
  WITH CHECK (private.actor_unrestricted());

-- ============================================================================
-- L5. Display-name snapshots come from the database, not the client
-- ============================================================================
-- reports: reporter_display_name / reported_display_name were taken from the
-- inserted row. This trigger runs after enforce_report_before_insert (BEFORE
-- triggers fire in name order) so reporter_profile_id is already forced to
-- auth.uid() and, for message reports, reported_profile_id to the sender.
CREATE OR REPLACE FUNCTION private.snapshot_report_display_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.reporter_display_name :=
    (SELECT p.display_name FROM public.profiles p WHERE p.id = NEW.reporter_profile_id);
  NEW.reported_display_name :=
    (SELECT p.display_name FROM public.profiles p WHERE p.id = NEW.reported_profile_id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.snapshot_report_display_names() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS snapshot_report_display_names ON public.reports;
CREATE TRIGGER snapshot_report_display_names
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION private.snapshot_report_display_names();

-- moderation_actions: admin_display_name (and subject_display_name) are taken
-- from profiles whenever the row links a profile. When a link is NULL the
-- supplied text is kept: the permanent-deletion audit row (service role) has
-- subject_profile_id NULL and carries the deleted account's name as text.
-- Free-text note / previous_status / new_status are unchanged.
CREATE OR REPLACE FUNCTION private.snapshot_moderation_display_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.admin_profile_id IS NOT NULL THEN
    NEW.admin_display_name :=
      (SELECT p.display_name FROM public.profiles p WHERE p.id = NEW.admin_profile_id);
  END IF;
  IF NEW.subject_profile_id IS NOT NULL THEN
    NEW.subject_display_name :=
      (SELECT p.display_name FROM public.profiles p WHERE p.id = NEW.subject_profile_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.snapshot_moderation_display_names() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS snapshot_moderation_display_names ON public.moderation_actions;
CREATE TRIGGER snapshot_moderation_display_names
  BEFORE INSERT ON public.moderation_actions
  FOR EACH ROW EXECUTE FUNCTION private.snapshot_moderation_display_names();

-- ============================================================================
-- L4. Hidden status flag also requires a staff caller
-- ============================================================================
-- public.admin_set_profile_hidden sets ballfindr.moderation_rpc = 'on' around
-- its UPDATE after checking public.can_moderate(). The trigger previously
-- trusted the flag alone; it now also re-checks can_moderate(). Admins are
-- still allowed directly. No server code writes is_hidden with the service
-- role (it always goes through the RPC with the caller's token).
CREATE OR REPLACE FUNCTION public.protect_hidden_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.is_hidden is distinct from old.is_hidden
     and not public.is_admin()
     and not (coalesce(current_setting('ballfindr.moderation_rpc', true), '') = 'on'
              and public.can_moderate()) then
    raise exception 'Profile visibility can only be changed by an administrator or moderator';
  end if;
  return new;
end $function$;
REVOKE ALL ON FUNCTION public.protect_hidden_status() FROM PUBLIC, anon, authenticated;
