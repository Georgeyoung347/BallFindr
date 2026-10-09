
-- ============================================================
-- 1. Account restrictions
-- ============================================================
create table if not exists public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('temporary','permanent')),
  reason text,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id),
  lifted_reason text,
  constraint temporary_needs_expiry check (
    (kind = 'temporary' and expires_at is not null) or (kind = 'permanent' and expires_at is null)
  )
);

create unique index if not exists account_restrictions_one_active
  on public.account_restrictions (profile_id) where lifted_at is null;
create index if not exists account_restrictions_profile_idx
  on public.account_restrictions (profile_id, created_at desc);

grant select on public.account_restrictions to authenticated;
grant insert, update on public.account_restrictions to authenticated;
grant all on public.account_restrictions to service_role;

alter table public.account_restrictions enable row level security;

create policy "Admins read every restriction"
  on public.account_restrictions for select to authenticated using (public.is_admin());
create policy "Members read their own restriction"
  on public.account_restrictions for select to authenticated using (profile_id = auth.uid());
create policy "Only admins create restrictions"
  on public.account_restrictions for insert to authenticated with check (public.is_admin());
create policy "Only admins change restrictions"
  on public.account_restrictions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger set_account_restrictions_updated_at
  before update on public.account_restrictions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. Moderation audit trail (admin only)
-- ============================================================
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references public.profiles(id),
  action text not null,
  subject_profile_id uuid references public.profiles(id),
  report_id uuid references public.reports(id) on delete set null,
  restriction_id uuid references public.account_restrictions(id) on delete set null,
  note text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_created_idx on public.moderation_actions (created_at desc);

grant select, insert on public.moderation_actions to authenticated;
grant all on public.moderation_actions to service_role;

alter table public.moderation_actions enable row level security;

create policy "Admins read the moderation log"
  on public.moderation_actions for select to authenticated using (public.is_admin());
create policy "Admins write the moderation log"
  on public.moderation_actions for insert to authenticated
  with check (public.is_admin() and admin_profile_id = auth.uid());

-- ============================================================
-- 3. Restriction helpers
-- ============================================================
create or replace function private.is_restricted(_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_restrictions r
    where r.profile_id = _profile_id
      and r.lifted_at is null
      and (r.expires_at is null or r.expires_at > now())
  )
$$;

revoke all on function private.is_restricted(uuid) from public;
grant execute on function private.is_restricted(uuid) to authenticated, service_role;

-- Visible unless restricted; the account itself and admins always see it.
create or replace function private.account_visible(_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _profile_id is null
      or auth.uid() = _profile_id
      or public.is_admin()
      or not private.is_restricted(_profile_id)
$$;

revoke all on function private.account_visible(uuid) from public;
grant execute on function private.account_visible(uuid) to authenticated, service_role;

-- The signed-in caller may act (write) unless they are restricted.
create or replace function private.actor_unrestricted()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or public.is_admin()
      or not private.is_restricted(auth.uid())
$$;

revoke all on function private.actor_unrestricted() from public;
grant execute on function private.actor_unrestricted() to authenticated, service_role;

-- Owner-scoped read of one's own restriction, for the in-app notice.
create or replace function public.my_restriction()
returns table(kind text, reason text, expires_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.kind, r.reason, r.expires_at, r.created_at
  from public.account_restrictions r
  where r.profile_id = auth.uid()
    and r.lifted_at is null
    and (r.expires_at is null or r.expires_at > now())
  limit 1
$$;

revoke all on function public.my_restriction() from public;
grant execute on function public.my_restriction() to authenticated, service_role;

-- ============================================================
-- 4. Hide restricted accounts from ordinary members
-- ============================================================
create policy "Hide restricted accounts" on public.profiles
  as restrictive for select to authenticated using (private.account_visible(id));
create policy "Hide restricted players" on public.players
  as restrictive for select to authenticated using (private.account_visible(id));
create policy "Hide restricted clubs" on public.clubs
  as restrictive for select to authenticated using (private.account_visible(id));
create policy "Hide restricted club vacancies" on public.vacancies
  as restrictive for select to authenticated using (private.account_visible(club_id));
create policy "Hide restricted saved players" on public.saved_players
  as restrictive for select to authenticated
  using (private.account_visible(player_id) and private.account_visible(club_id));
create policy "Hide restricted saved clubs" on public.saved_clubs
  as restrictive for select to authenticated
  using (private.account_visible(player_id) and private.account_visible(club_id));
create policy "Hide restricted saved vacancies" on public.saved_vacancies
  as restrictive for select to authenticated using (private.account_visible(player_id));
create policy "Hide restricted applications" on public.applications
  as restrictive for select to authenticated
  using (private.account_visible(player_id) and private.account_visible(club_id));
create policy "Hide restricted trial invites" on public.trial_invites
  as restrictive for select to authenticated
  using (private.account_visible(player_id) and private.account_visible(club_id));
create policy "Hide restricted conversations" on public.conversations
  as restrictive for select to authenticated
  using (private.account_visible(player_id) and private.account_visible(club_id));

-- ============================================================
-- 5. Block writes by restricted accounts
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'messages','conversations','conversation_participants','applications','vacancies','media',
    'saved_players','saved_clubs','saved_vacancies','trial_invites','profiles','players','clubs',
    'achievements','player_history','club_history','reports','profile_views'
  ] loop
    execute format(
      'create policy "Restricted accounts cannot insert" on public.%I as restrictive for insert to authenticated with check (private.actor_unrestricted())', t);
    execute format(
      'create policy "Restricted accounts cannot update" on public.%I as restrictive for update to authenticated using (private.actor_unrestricted()) with check (private.actor_unrestricted())', t);
  end loop;
end $$;

-- ============================================================
-- 6. Message reports
-- ============================================================
alter table public.reports
  add column if not exists kind text not null default 'profile',
  add column if not exists message_id uuid references public.messages(id) on delete set null,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists message_body text,
  add column if not exists message_sent_at timestamptz;

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('profile','message'));

-- Members must not read internal resolution notes on their own reports.
drop policy if exists "Users can see the reports they submitted" on public.reports;

create or replace function public.enforce_report_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_msg public.messages%rowtype;
  v_conv public.conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to report an account';
  end if;
  new.reporter_profile_id := auth.uid();
  if new.reported_profile_id = auth.uid() then
    raise exception 'You cannot report your own account';
  end if;
  new.reason := btrim(coalesce(new.reason, ''));
  if char_length(new.reason) = 0 then
    raise exception 'A reason is required';
  end if;
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  if char_length(coalesce(new.details, '')) > 2000 then
    raise exception 'Details are too long (max 2000 characters)';
  end if;
  new.status := 'open';
  new.resolution_notes := null;
  new.resolved_at := null;
  new.resolved_by := null;
  new.created_at := now();

  if new.kind = 'message' then
    if new.message_id is null then
      raise exception 'A message is required';
    end if;
    select * into v_msg from public.messages where id = new.message_id;
    if v_msg.id is null then
      raise exception 'Message not found';
    end if;
    select * into v_conv from public.conversations where id = v_msg.conversation_id;
    if auth.uid() <> v_conv.club_id and auth.uid() <> v_conv.player_id then
      raise exception 'You are not part of this conversation';
    end if;
    if v_msg.sender_id = auth.uid() then
      raise exception 'You cannot report your own message';
    end if;
    -- Evidence is taken from the database, never from the browser.
    new.reported_profile_id := v_msg.sender_id;
    new.conversation_id := v_msg.conversation_id;
    new.message_body := v_msg.body;
    new.message_sent_at := v_msg.created_at;
  else
    new.kind := 'profile';
    new.message_id := null;
    new.conversation_id := null;
    new.message_body := null;
    new.message_sent_at := null;
  end if;
  return new;
end $$;

drop trigger if exists enforce_report_before_insert on public.reports;
create trigger enforce_report_before_insert
  before insert on public.reports
  for each row execute function public.enforce_report_insert();

-- Reported evidence may only be changed by an administrator.
create or replace function public.enforce_report_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can change a report';
  end if;
  if new.reporter_profile_id is distinct from old.reporter_profile_id
     or new.reported_profile_id is distinct from old.reported_profile_id
     or new.kind is distinct from old.kind
     or new.reason is distinct from old.reason
     or new.details is distinct from old.details
     or new.message_id is distinct from old.message_id
     or new.conversation_id is distinct from old.conversation_id
     or new.message_body is distinct from old.message_body
     or new.message_sent_at is distinct from old.message_sent_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Report evidence cannot be changed';
  end if;
  return new;
end $$;

drop trigger if exists enforce_report_before_update on public.reports;
create trigger enforce_report_before_update
  before update on public.reports
  for each row execute function public.enforce_report_update();

-- ============================================================
-- 7. Restricted accounts cannot use messaging
-- ============================================================
create or replace function public.enforce_message_insert()
returns trigger language plpgsql set search_path = public as $function$
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
  if private.is_restricted(new.sender_id) then
    raise exception 'Your account is restricted, so you cannot send messages';
  end if;
  if private.is_restricted(case when new.sender_id = v_conv.club_id then v_conv.player_id else v_conv.club_id end) then
    raise exception 'This account is restricted, so messages cannot be sent';
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
end $function$;

create or replace function public.enforce_conversation_insert()
returns trigger language plpgsql set search_path = public as $function$
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
  if private.is_restricted(new.club_id) or private.is_restricted(new.player_id) then
    raise exception 'You cannot message this player';
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
end $function$;
