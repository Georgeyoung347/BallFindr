-- Players: discoverable to any signed-in member. date_of_birth has no column
-- grant to `authenticated`, so widening the row policy cannot expose it.
DROP POLICY IF EXISTS "Players readable by self or club accounts" ON public.players;
CREATE POLICY "Player records readable by authenticated users"
  ON public.players FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Player history readable by self or club accounts" ON public.player_history;
CREATE POLICY "Player history readable by authenticated users"
  ON public.player_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Media readable by owner or club accounts" ON public.media;
CREATE POLICY "Media readable by authenticated users"
  ON public.media FOR SELECT TO authenticated USING (true);

-- Safe calculated age for any signed-in viewer; date_of_birth never leaves here.
CREATE OR REPLACE FUNCTION public.player_age(_player_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select case when p.date_of_birth is null then null
              else date_part('year', age(p.date_of_birth))::int end
  from public.players p
  where p.id = _player_id
    and auth.uid() is not null
$$;
REVOKE ALL ON FUNCTION public.player_age(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.player_age(uuid) TO authenticated, service_role;

-- Storage: both buckets hold only discoverable profile/portfolio imagery.
-- Writes stay owner-only (existing INSERT/UPDATE/DELETE policies unchanged).
DROP POLICY IF EXISTS "Owner, club images, or club viewers can view profile images" ON storage.objects;
CREATE POLICY "Profile images viewable by authenticated users"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "Owner or club accounts can view player media" ON storage.objects;
CREATE POLICY "Player media viewable by authenticated users"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-media');
