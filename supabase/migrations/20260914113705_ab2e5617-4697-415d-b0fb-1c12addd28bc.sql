drop policy if exists "Authenticated users can view profile images" on storage.objects;

create policy "Owner, club images, or club viewers can view profile images"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles owner
      where owner.id::text = (storage.foldername(name))[1]
        and owner.account_type = 'club'
    )
    or exists (
      select 1 from public.profiles viewer
      where viewer.id = auth.uid()
        and viewer.account_type = 'club'
    )
  )
);