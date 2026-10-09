DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR (
    private.account_visible(id)
    AND (account_type <> 'club'::account_type OR private.can_view_club(id))
  )
);

DROP POLICY IF EXISTS "Player records readable by authenticated users" ON public.players;
CREATE POLICY "Player records readable by authenticated users"
ON public.players FOR SELECT TO authenticated
USING (auth.uid() = id OR private.account_visible(id));

DROP POLICY IF EXISTS "Clubs are readable by authenticated users" ON public.clubs;
CREATE POLICY "Clubs are readable by authenticated users"
ON public.clubs FOR SELECT TO authenticated
USING (auth.uid() = id OR (private.account_visible(id) AND private.can_view_club(id)));

DROP POLICY IF EXISTS "Vacancies are readable by authenticated users" ON public.vacancies;
CREATE POLICY "Vacancies are readable by authenticated users"
ON public.vacancies FOR SELECT TO authenticated
USING (
  auth.uid() = club_id
  OR (private.account_visible(club_id) AND private.can_view_club(club_id))
);

DROP POLICY IF EXISTS "Player history readable by authenticated users" ON public.player_history;
CREATE POLICY "Player history readable by authenticated users"
ON public.player_history FOR SELECT TO authenticated
USING (auth.uid() = player_id OR private.account_visible(player_id));

DROP POLICY IF EXISTS "Achievements are readable by authenticated users" ON public.achievements;
CREATE POLICY "Achievements are readable by authenticated users"
ON public.achievements FOR SELECT TO authenticated
USING (auth.uid() = profile_id OR private.account_visible(profile_id));

DROP POLICY IF EXISTS "Media readable by authenticated users" ON public.media;
CREATE POLICY "Media readable by authenticated users"
ON public.media FOR SELECT TO authenticated
USING (auth.uid() = owner_profile_id OR private.account_visible(owner_profile_id));

DROP POLICY IF EXISTS "Club history is readable by authenticated users" ON public.club_history;
CREATE POLICY "Club history is readable by authenticated users"
ON public.club_history FOR SELECT TO authenticated
USING (
  auth.uid() = club_id
  OR (private.account_visible(club_id) AND private.can_view_club(club_id))
);

DROP POLICY IF EXISTS "Levels are readable by everyone" ON public.levels;
CREATE POLICY "Levels are readable by signed-in users"
ON public.levels FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.levels FROM anon;