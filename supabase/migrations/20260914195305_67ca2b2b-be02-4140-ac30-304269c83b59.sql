drop policy if exists "Player media viewable by authenticated users" on storage.objects;
create policy "Player media readable when published or owned"
on storage.objects for select to authenticated
using (
  bucket_id = 'player-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.media m
      where m.bucket = 'player-media' and m.storage_path = storage.objects.name
    )
  )
);

drop policy if exists "Profile images viewable by authenticated users" on storage.objects;
create policy "Profile images readable when in use or owned"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.avatar_path = storage.objects.name or p.cover_path = storage.objects.name
    )
    or exists (
      select 1 from public.clubs c
      where c.badge_path = storage.objects.name
         or c.team_photo_path = storage.objects.name
         or c.home_ground_photo_path = storage.objects.name
         or c.training_pitch_photo_path = storage.objects.name
    )
  )
);