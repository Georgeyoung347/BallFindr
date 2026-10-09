alter table public.media
  add column if not exists caption text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists duration_seconds numeric(6,2),
  add column if not exists content_type text,
  add column if not exists size_bytes bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists media_owner_sort_idx on public.media (owner_profile_id, sort_order, created_at);

create or replace function public.enforce_media_write()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_ext text;
begin
  if auth.uid() is null or auth.uid() <> new.owner_profile_id then
    raise exception 'You can only manage your own media';
  end if;
  if not exists (select 1 from public.profiles where id = new.owner_profile_id and account_type = 'player') then
    raise exception 'Only player accounts can add media';
  end if;
  if new.kind not in ('photo', 'video') then
    raise exception 'Media must be a photo or a video clip';
  end if;
  if new.bucket <> 'player-media' then
    raise exception 'Media must be stored in the player media bucket';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.owner_profile_id::text or position('..' in new.storage_path) > 0 then
    raise exception 'Media must be stored in your own folder';
  end if;
  v_ext := lower(regexp_replace(new.storage_path, '^.*\.', ''));
  new.title := nullif(btrim(coalesce(new.title, '')), '');
  new.caption := nullif(btrim(coalesce(new.caption, '')), '');
  if char_length(coalesce(new.title, '')) > 80 then
    raise exception 'Title is too long (max 80 characters)';
  end if;
  if char_length(coalesce(new.caption, '')) > 300 then
    raise exception 'Caption is too long (max 300 characters)';
  end if;
  if new.kind = 'photo' then
    if v_ext not in ('jpg', 'jpeg', 'png', 'webp') or coalesce(new.content_type, '') not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Photos must be JPEG, PNG or WebP';
    end if;
    if new.size_bytes is null or new.size_bytes > 8 * 1024 * 1024 then
      raise exception 'Photos must be 8 MB or smaller';
    end if;
    new.duration_seconds := null;
  else
    if v_ext not in ('mp4', 'mov', 'webm') or coalesce(new.content_type, '') not in ('video/mp4', 'video/quicktime', 'video/webm') then
      raise exception 'Video clips must be MP4, MOV or WebM';
    end if;
    if new.size_bytes is null or new.size_bytes > 50 * 1024 * 1024 then
      raise exception 'Video clips must be 50 MB or smaller';
    end if;
    if new.duration_seconds is null or new.duration_seconds <= 0 or new.duration_seconds > 15.05 then
      raise exception 'Video clips must be 15 seconds or shorter';
    end if;
  end if;
  if new.sort_order < 0 then new.sort_order := 0; end if;
  if tg_op = 'UPDATE' then
    if new.owner_profile_id <> old.owner_profile_id or new.kind <> old.kind
       or new.bucket <> old.bucket or new.storage_path <> old.storage_path then
      raise exception 'Media files cannot be changed; remove and upload again';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists enforce_media_before_write on public.media;
create trigger enforce_media_before_write
before insert or update on public.media
for each row execute function public.enforce_media_write();

create policy "Authenticated users can view player media"
on storage.objects for select to authenticated
using (bucket_id = 'player-media');

create policy "Players can upload their own media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'player')
);

create policy "Players can replace their own media"
on storage.objects for update to authenticated
using (
  bucket_id = 'player-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'player-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm')
);

create policy "Players can remove their own media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'player-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);