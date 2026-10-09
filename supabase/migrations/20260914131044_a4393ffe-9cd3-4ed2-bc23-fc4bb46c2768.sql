create or replace function public.enforce_media_write()
returns trigger
language plpgsql
security definer
set search_path = public
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
      raise exception 'Video clips must be 50 MB or smaller after compression';
    end if;
    if new.duration_seconds is null or new.duration_seconds <= 0 or new.duration_seconds > 20.05 then
      raise exception 'Video clips must be 20 seconds or shorter';
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
end
$$;
revoke execute on function public.enforce_media_write() from public, anon, authenticated;