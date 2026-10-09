alter table public.profiles
  add column if not exists cover_path text;

alter table public.clubs
  add column if not exists team_photo_path text,
  add column if not exists home_ground_photo_path text,
  add column if not exists training_pitch_photo_path text;

create policy "Authenticated users can view profile images"
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-images');

create policy "Users can upload their own profile images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "Users can replace their own profile images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "Users can remove their own profile images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);