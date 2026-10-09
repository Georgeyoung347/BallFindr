
ALTER TABLE public.message_blocks ADD COLUMN IF NOT EXISTS unblocked_at timestamptz;

CREATE OR REPLACE FUNCTION public.messaging_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  select exists (
    select 1 from public.message_blocks
    where unblocked_at is null
      and ((blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a))
  )
$function$;

CREATE OR REPLACE FUNCTION public.enforce_conversation_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if new.club_id <> old.club_id or new.player_id <> old.player_id then
    raise exception 'Conversation participants cannot be changed';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  if pg_trigger_depth() > 1 then
    new.status := old.status;
    new.paused_by := old.paused_by; new.paused_at := old.paused_at;
    new.blocked_by := old.blocked_by; new.blocked_at := old.blocked_at;
    return new;
  end if;

  new.last_message_at := old.last_message_at;
  new.last_message_preview := old.last_message_preview;
  new.last_message_sender_id := old.last_message_sender_id;

  if v_uid is null or (v_uid <> old.club_id and v_uid <> old.player_id) then
    raise exception 'Not allowed to update this conversation';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'blocked' then
      -- Only the blocker can lift their own block, and only back to active.
      if new.status <> 'active' then
        raise exception 'This conversation has been blocked';
      end if;
      if old.blocked_by is distinct from v_uid then
        raise exception 'Only the person who blocked this conversation can unblock it';
      end if;
      new.blocked_by := null; new.blocked_at := null;
      new.paused_by := old.paused_by; new.paused_at := old.paused_at;
      if new.paused_by is not null then
        new.status := 'paused';
      end if;
      return new;
    end if;
    if new.status = 'paused' then
      if old.status <> 'active' then
        raise exception 'Only an active conversation can be paused';
      end if;
      new.paused_by := v_uid; new.paused_at := now();
      new.blocked_by := old.blocked_by; new.blocked_at := old.blocked_at;
    elsif new.status = 'active' then
      if old.paused_by is distinct from v_uid then
        raise exception 'Only the person who paused this conversation can resume it';
      end if;
      new.paused_by := null; new.paused_at := null;
      new.blocked_by := old.blocked_by; new.blocked_at := old.blocked_at;
    elsif new.status = 'blocked' then
      new.blocked_by := v_uid; new.blocked_at := now();
      new.paused_by := old.paused_by; new.paused_at := old.paused_at;
    end if;
  else
    new.paused_by := old.paused_by; new.paused_at := old.paused_at;
    new.blocked_by := old.blocked_by; new.blocked_at := old.blocked_at;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.on_conversation_blocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_other uuid; v_blocker uuid;
begin
  if new.status = 'blocked' and old.status <> 'blocked' and new.blocked_by is not null then
    v_other := case when new.blocked_by = new.club_id then new.player_id else new.club_id end;
    insert into public.message_blocks (blocker_id, blocked_id)
    values (new.blocked_by, v_other)
    on conflict (blocker_id, blocked_id) do update
      set unblocked_at = null, created_at = now();
  elsif old.status = 'blocked' and new.status <> 'blocked' and old.blocked_by is not null then
    v_blocker := old.blocked_by;
    v_other := case when v_blocker = new.club_id then new.player_id else new.club_id end;
    update public.message_blocks
      set unblocked_at = now()
      where blocker_id = v_blocker and blocked_id = v_other and unblocked_at is null;
  end if;
  return new;
end $function$;

REVOKE ALL ON FUNCTION public.on_conversation_blocked() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_conversation_update() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_blocked(uuid, uuid) TO authenticated, service_role;
