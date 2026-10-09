create type public.trial_invite_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type public.trial_surface as enum ('grass', '3g', '4g', 'astro', 'other');

create table public.trial_invites (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  vacancy_id uuid not null references public.vacancies(id) on delete cascade,
  trial_date date not null,
  start_time time not null,
  end_time time not null,
  surface public.trial_surface not null,
  surface_other text,
  venue_name text not null,
  street_address text not null,
  postcode text not null,
  arrival_time time,
  what_to_bring text,
  kit_instructions text,
  changing_info text,
  additional_instructions text,
  contact_name text,
  contact_phone text,
  notes text,
  status public.trial_invite_status not null default 'pending',
  decline_reason text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trial_invites_time_order check (start_time < end_time),
  constraint trial_invites_venue_not_blank check (length(trim(venue_name)) > 0),
  constraint trial_invites_street_not_blank check (length(trim(street_address)) > 0),
  constraint trial_invites_postcode_not_blank check (length(trim(postcode)) > 0),
  constraint trial_invites_surface_other check (surface <> 'other' or length(trim(coalesce(surface_other, ''))) > 0)
);

create index trial_invites_application_idx on public.trial_invites(application_id);
create index trial_invites_player_idx on public.trial_invites(player_id, trial_date);
create index trial_invites_club_idx on public.trial_invites(club_id, trial_date);
create unique index trial_invites_one_active_per_application
  on public.trial_invites(application_id) where status in ('pending', 'accepted');

grant select, insert, update, delete on public.trial_invites to authenticated;
grant all on public.trial_invites to service_role;

alter table public.trial_invites enable row level security;

create policy "Involved club or player can read a trial invite"
  on public.trial_invites for select to authenticated
  using (auth.uid() = club_id or auth.uid() = player_id);

create policy "Clubs create trial invites for their own applications"
  on public.trial_invites for insert to authenticated
  with check (
    auth.uid() = club_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.club_id = auth.uid()
    )
  );

create policy "Involved club or player can update a trial invite"
  on public.trial_invites for update to authenticated
  using (auth.uid() = club_id or auth.uid() = player_id)
  with check (auth.uid() = club_id or auth.uid() = player_id);

create policy "Clubs delete their own trial invites"
  on public.trial_invites for delete to authenticated
  using (auth.uid() = club_id);

-- Derive ownership from the application; never trust ids from the client.
create or replace function public.enforce_trial_invite_insert()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app from public.applications where id = new.application_id;
  if v_app.id is null then
    raise exception 'Application % not found', new.application_id;
  end if;
  if auth.uid() is distinct from v_app.club_id then
    raise exception 'Only the club that owns this application can invite the player to a trial';
  end if;
  if v_app.stage in ('rejected', 'withdrawn') then
    raise exception 'This application has ended, so the player cannot be invited to a trial';
  end if;
  if new.trial_date < (now() at time zone 'Europe/London')::date then
    raise exception 'Trial date cannot be in the past';
  end if;
  new.club_id := v_app.club_id;
  new.player_id := v_app.player_id;
  new.vacancy_id := v_app.vacancy_id;
  new.status := 'pending';
  new.decline_reason := null;
  new.responded_at := null;
  if new.surface <> 'other' then new.surface_other := null; end if;
  return new;
end $$;

create trigger enforce_trial_invite_before_insert
  before insert on public.trial_invites
  for each row execute function public.enforce_trial_invite_insert();

-- Players may only respond; clubs may edit details or cancel. Links are immutable.
create or replace function public.enforce_trial_invite_update()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.application_id <> old.application_id or new.club_id <> old.club_id
     or new.player_id <> old.player_id or new.vacancy_id <> old.vacancy_id then
    raise exception 'Trial invite links cannot be changed';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  if v_uid = old.player_id and v_uid is distinct from old.club_id then
    -- Player: only status / decline_reason may change.
    if new.trial_date is distinct from old.trial_date or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time or new.surface is distinct from old.surface
       or new.surface_other is distinct from old.surface_other or new.venue_name is distinct from old.venue_name
       or new.street_address is distinct from old.street_address or new.postcode is distinct from old.postcode
       or new.arrival_time is distinct from old.arrival_time or new.what_to_bring is distinct from old.what_to_bring
       or new.kit_instructions is distinct from old.kit_instructions or new.changing_info is distinct from old.changing_info
       or new.additional_instructions is distinct from old.additional_instructions
       or new.contact_name is distinct from old.contact_name or new.contact_phone is distinct from old.contact_phone
       or new.notes is distinct from old.notes then
      raise exception 'Players cannot change trial details';
    end if;
    if new.status is distinct from old.status then
      if old.status = 'cancelled' then
        raise exception 'This trial invitation has been cancelled';
      end if;
      if new.status not in ('accepted', 'declined') then
        raise exception 'Players can only accept or decline a trial invitation';
      end if;
      if old.status = 'declined' then
        raise exception 'This invitation has already been declined';
      end if;
      new.responded_at := now();
      if new.status = 'accepted' then new.decline_reason := null; end if;
    else
      new.responded_at := old.responded_at;
      if old.status <> 'declined' then new.decline_reason := old.decline_reason; end if;
    end if;
    return new;
  end if;

  if v_uid = old.club_id then
    -- Club: may edit details or cancel, but never answer on the player's behalf.
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'Clubs can only cancel a trial invitation';
    end if;
    new.decline_reason := old.decline_reason;
    new.responded_at := old.responded_at;
    if new.surface <> 'other' then new.surface_other := null; end if;
    return new;
  end if;

  raise exception 'Not allowed to update this trial invitation';
end $$;

create trigger enforce_trial_invite_before_update
  before update on public.trial_invites
  for each row execute function public.enforce_trial_invite_update();

-- Short human label used in notifications.
create or replace function public.trial_invite_summary(_i public.trial_invites)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select to_char(_i.trial_date, 'FMDay FMDD Month') || ' · '
      || to_char(_i.start_time, 'HH24:MI') || '–' || to_char(_i.end_time, 'HH24:MI')
      || ' · ' || _i.venue_name
$$;

-- Existing stage-change trigger: when moving to "trial" and an invite exists,
-- link the notification to the invitation instead of the generic application.
create or replace function public.on_application_stage_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_invite public.trial_invites%rowtype;
  v_club_name text;
begin
  if new.stage is distinct from old.stage then
    insert into public.application_events (application_id, from_stage, to_stage, actor_profile_id)
    values (new.id, old.stage, new.stage, auth.uid());

    select name into v_club_name from public.clubs where id = new.club_id;

    if new.stage = 'trial' then
      select * into v_invite from public.trial_invites
      where application_id = new.id and status = 'pending'
      order by created_at desc limit 1;
    end if;

    if v_invite.id is not null then
      insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
      values (new.player_id, 'trial_invite',
              coalesce(v_club_name, 'A club') || ' has invited you to a trial',
              public.trial_invite_summary(v_invite),
              'trial_invite', v_invite.id);
    else
      insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
      values (new.player_id, 'stage_change',
              'Application update: ' || new.stage,
              coalesce(v_club_name, 'A club') || ' moved your application to ' || new.stage,
              'application', new.id);
    end if;
  end if;
  return new;
end $$;

-- After an invite is created: move the application to "trial" (which records the
-- event + notification above). If it's already at "trial", notify directly.
create or replace function public.on_trial_invite_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_stage public.application_stage;
  v_club_name text;
begin
  select stage into v_stage from public.applications where id = new.application_id;
  if v_stage is distinct from 'trial' then
    update public.applications set stage = 'trial' where id = new.application_id;
  else
    select name into v_club_name from public.clubs where id = new.club_id;
    insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
    values (new.player_id, 'trial_invite',
            coalesce(v_club_name, 'A club') || ' has invited you to a trial',
            public.trial_invite_summary(new),
            'trial_invite', new.id);
  end if;
  return new;
end $$;

create trigger on_trial_invite_insert
  after insert on public.trial_invites
  for each row execute function public.on_trial_invite_insert();

-- Tell the club when the player responds.
create or replace function public.on_trial_invite_response()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text;
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'declined') then
    select display_name into v_name from public.profiles where id = new.player_id;
    insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
    values (new.club_id, 'trial_response',
            coalesce(v_name, 'A player') || ' has ' || new.status::text || ' your trial invitation',
            public.trial_invite_summary(new),
            'trial_invite', new.id);
  end if;
  return new;
end $$;

create trigger on_trial_invite_response
  after update on public.trial_invites
  for each row execute function public.on_trial_invite_response();