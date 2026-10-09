DROP POLICY IF EXISTS "Player media readable when published or owned" ON storage.objects;
CREATE POLICY "Player media readable when published or owned"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'player-media'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.media m
      WHERE m.bucket = 'player-media'
        AND m.storage_path = objects.name
        AND private.account_visible(m.owner_profile_id)
    )
  )
);

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
        AND private.account_visible(c.id)
        AND private.can_view_club(c.id)
    )
  )
);