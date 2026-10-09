-- ============================================================ types
create type public.conversation_status as enum ('active', 'paused', 'blocked');

-- ============================================================ tables
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status public.conversation_status not null default 'active',
  paused_by uuid references public.profiles(id) on delete set null,
  paused_at timestamptz,
  blocked_by uuid references public.profiles(id) on delete set null,
  blocked_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_club_player_unique unique (club_id, player_id),
  constraint conversations_not_self check (club_id <> player_id)
);
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create index conversations_club_idx on public.conversations (club_id, last_message_at desc nulls last);
create index conversations_player_idx on public.conversations (player_id, last_message_at desc nulls last);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  muted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
grant select, update on public.conversation_participants to authenticated;
grant all on public.conversation_participants to service_role;
alter table public.conversation_participants enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(body) between 1 and 2000)
);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_unread_idx on public.messages (conversation_id, sender_id) where read_at is null;

create table public.message_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint message_blocks_unique unique (blocker_id, blocked_id),
  constraint message_blocks_not_self check (blocker_id <> blocked_id)
);
grant select on public.message_blocks to authenticated;
grant all on public.message_blocks to service_role;
alter table public.message_blocks enable row level security;
create index message_blocks_blocked_idx on public.message_blocks (blocked_id);

-- ============================================================ helper functions
create or replace function public.messaging_blocked(_a uuid, _b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.message_blocks
    where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a)
  )
$$;
revoke all on function public.messaging_blocked(uuid, uuid) from public;
grant execute on function public.messaging_blocked(uuid, uuid) to authenticated, service_role;

create or replace function public.is_conversation_participant(_conversation_id uuid, _profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = _conversation_id and (c.club_id = _profile_id or c.player_id = _profile_id)
  )
$$;
revoke all on function public.is_conversation_participant(uuid, uuid) from public;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated, service_role;

-- ============================================================ conversation triggers
create or replace function public.enforce_conversation_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> new.club_id then
    raise exception 'Only a club can start a conversation, and only as itself';
  end if;
  if not exists (select 1 from public.profiles where id = new.club_id and account_type = 'club') then
    raise exception 'Only club accounts can start conversations';
  end if;
  if not exists (select 1 from public.players where id = new.player_id) then
    raise exception 'Player not found';
  end if;
  if public.messaging_blocked(new.club_id, new.player_id) then
    raise exception 'You cannot message this player';
  end if;
  new.status := 'active';
  new.paused_by := null; new.paused_at := null;
  new.blocked_by := null; new.blocked_at := null;
  new.last_message_at := null; new.last_message_preview := null; new.last_message_sender_id := null;
  new.created_at := now(); new.updated_at := now();
  return new;
end $$;
create trigger enforce_conversation_before_insert
  before insert on public.conversations
  for each row execute function public.enforce_conversation_insert();

create or replace function public.on_conversation_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.conversation_participants (conversation_id, profile_id)
  values (new.id, new.club_id), (new.id, new.player_id)
  on conflict do nothing;
  return new;
end $$;
create trigger on_conversation_insert
  after insert on public.conversations
  for each row execute function public.on_conversation_insert();

create or replace function public.enforce_conversation_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.club_id <> old.club_id or new.player_id <> old.player_id then
    raise exception 'Conversation participants cannot be changed';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- Nested call from the message trigger: only the latest-message summary may move.
  if pg_trigger_depth() > 1 then
    new.status := old.status;
    new.paused_by := old.paused_by; new.paused_at := old.paused_at;
    new.blocked_by := old.blocked_by; new.blocked_at := old.blocked_at;
    return new;
  end if;

  -- User-driven update: the summary columns are read-only.
  new.last_message_at := old.last_message_at;
  new.last_message_preview := old.last_message_preview;
  new.last_message_sender_id := old.last_message_sender_id;

  if v_uid is null or (v_uid <> old.club_id and v_uid <> old.player_id) then
    raise exception 'Not allowed to update this conversation';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'blocked' then
      raise exception 'This conversation has been blocked';
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
end $$;
create trigger enforce_conversation_before_update
  before update on public.conversations
  for each row execute function public.enforce_conversation_update();

create or replace function public.on_conversation_blocked()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid;
begin
  if new.status = 'blocked' and old.status <> 'blocked' and new.blocked_by is not null then
    v_other := case when new.blocked_by = new.club_id then new.player_id else new.club_id end;
    insert into public.message_blocks (blocker_id, blocked_id)
    values (new.blocked_by, v_other)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_conversation_blocked
  after update on public.conversations
  for each row execute function public.on_conversation_blocked();

-- ============================================================ participant triggers
create or replace function public.enforce_participant_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.conversation_id <> old.conversation_id or new.profile_id <> old.profile_id then
    raise exception 'Participant links cannot be changed';
  end if;
  if auth.uid() is distinct from old.profile_id then
    raise exception 'You can only change your own conversation settings';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;
create trigger enforce_participant_before_update
  before update on public.conversation_participants
  for each row execute function public.enforce_participant_update();

-- ============================================================ message triggers
create or replace function public.enforce_message_insert()
returns trigger language plpgsql set search_path = public as $$
declare v_conv public.conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to send messages';
  end if;
  new.sender_id := auth.uid();
  new.body := btrim(regexp_replace(coalesce(new.body, ''), '\s+$', ''));
  if char_length(new.body) = 0 then
    raise exception 'Message cannot be empty';
  end if;
  if char_length(new.body) > 2000 then
    raise exception 'Message is too long (max 2000 characters)';
  end if;
  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.id is null then
    raise exception 'Conversation not found';
  end if;
  if new.sender_id <> v_conv.club_id and new.sender_id <> v_conv.player_id then
    raise exception 'You are not part of this conversation';
  end if;
  if v_conv.status = 'paused' then
    raise exception 'This conversation is paused';
  end if;
  if v_conv.status = 'blocked' then
    raise exception 'This conversation has been blocked';
  end if;
  new.read_at := null;
  new.created_at := now();
  return new;
end $$;
create trigger enforce_message_before_insert
  before insert on public.messages
  for each row execute function public.enforce_message_insert();

create or replace function public.enforce_message_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.conversation_id <> old.conversation_id or new.sender_id <> old.sender_id
     or new.body <> old.body or new.created_at <> old.created_at then
    raise exception 'Messages cannot be edited';
  end if;
  if auth.uid() is null or auth.uid() = old.sender_id
     or not public.is_conversation_participant(old.conversation_id, auth.uid()) then
    raise exception 'Only the recipient can mark a message as read';
  end if;
  if old.read_at is not null then
    new.read_at := old.read_at;
  elsif new.read_at is not null then
    new.read_at := now();
  end if;
  return new;
end $$;
create trigger enforce_message_before_update
  before update on public.messages
  for each row execute function public.enforce_message_update();

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conv public.conversations%rowtype;
  v_recipient uuid;
  v_sender_name text;
  v_preview text;
  v_muted boolean;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  v_recipient := case when new.sender_id = v_conv.club_id then v_conv.player_id else v_conv.club_id end;
  v_preview := left(new.body, 140);

  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = v_preview,
         last_message_sender_id = new.sender_id
   where id = new.conversation_id;

  select muted_at is not null into v_muted
  from public.conversation_participants
  where conversation_id = new.conversation_id and profile_id = v_recipient;
  if coalesce(v_muted, false) then
    return new;
  end if;

  if new.sender_id = v_conv.club_id then
    select name into v_sender_name from public.clubs where id = new.sender_id;
  end if;
  if v_sender_name is null then
    select display_name into v_sender_name from public.profiles where id = new.sender_id;
  end if;

  -- Merge into an existing unread message notification for this conversation.
  update public.notifications
     set title = coalesce(v_sender_name, 'Someone') || ' sent you a message',
         body = v_preview,
         created_at = new.created_at
   where recipient_profile_id = v_recipient
     and type = 'new_message'
     and entity_type = 'conversation'
     and entity_id = new.conversation_id
     and read_at is null;
  if not found then
    insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
    values (v_recipient, 'new_message',
            coalesce(v_sender_name, 'Someone') || ' sent you a message',
            v_preview, 'conversation', new.conversation_id);
  end if;
  return new;
end $$;
create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ============================================================ RLS policies
create policy "Participants read their conversations"
  on public.conversations for select to authenticated
  using (auth.uid() = club_id or auth.uid() = player_id);

create policy "Clubs start conversations with players"
  on public.conversations for insert to authenticated
  with check (
    auth.uid() = club_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'club')
    and exists (select 1 from public.players pl where pl.id = player_id)
    and not public.messaging_blocked(club_id, player_id)
  );

create policy "Participants update their conversations"
  on public.conversations for update to authenticated
  using (auth.uid() = club_id or auth.uid() = player_id)
  with check (auth.uid() = club_id or auth.uid() = player_id);

create policy "Users read their own participant settings"
  on public.conversation_participants for select to authenticated
  using (auth.uid() = profile_id);

create policy "Users update their own participant settings"
  on public.conversation_participants for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Participants read messages"
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "Participants send messages in active conversations"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.club_id = auth.uid() or c.player_id = auth.uid())
        and c.status = 'active'
    )
  );

create policy "Recipients mark messages read"
  on public.messages for update to authenticated
  using (auth.uid() <> sender_id and public.is_conversation_participant(conversation_id, auth.uid()))
  with check (auth.uid() <> sender_id and public.is_conversation_participant(conversation_id, auth.uid()));

create policy "Users read blocks they created"
  on public.message_blocks for select to authenticated
  using (auth.uid() = blocker_id);

-- ============================================================ realtime (messaging tables only)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;