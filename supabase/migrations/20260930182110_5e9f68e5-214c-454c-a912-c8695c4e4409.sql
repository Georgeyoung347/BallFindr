alter table public.trial_invites alter column application_id drop not null, alter column vacancy_id drop not null;

create unique index trial_invites_one_active_direct on public.trial_invites (club_id, player_id)
  where application_id is null and status in ('pending','accepted');

create policy "Clubs create direct trial invites to players" on public.trial_invites
  for insert to authenticated
  with check (auth.uid() = club_id and application_id is null);

create or replace function public.enforce_trial_invite_insert()
 returns trigger language plpgsql set search_path to 'public'
as $function$
declare
  v_app public.applications%rowtype;
begin
  if new.application_id is null then
    -- Direct invite from a club viewing a player's profile (no application).
    if auth.uid() is null or auth.uid() is distinct from new.club_id then
      raise exception 'Only a club can invite a player to a trial, and only as itself';
    end if;
    if not exists (select 1 from public.profiles where id = new.club_id and account_type = 'club') then
      raise exception 'Only club accounts can invite players to a trial';
    end if;
    if not exists (select 1 from public.players where id = new.player_id) then
      raise exception 'Player not found';
    end if;
    if not exists (
      select 1 from public.clubs c, public.players p
       where c.id = new.club_id and p.id = new.player_id
         and case when c.football_section = 'both' then c.active_section else c.football_section end = p.football_section
    ) then
      raise exception 'You can only invite players in the football section you are operating in';
    end if;
    if private.is_restricted(new.club_id) or private.is_restricted(new.player_id)
       or public.messaging_blocked(new.club_id, new.player_id) then
      raise exception 'You cannot invite this player to a trial';
    end if;
    new.vacancy_id := null;
  else
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
    new.club_id := v_app.club_id;
    new.player_id := v_app.player_id;
    new.vacancy_id := v_app.vacancy_id;
  end if;
  if new.trial_date < (now() at time zone 'Europe/London')::date then
    raise exception 'Trial date cannot be in the past';
  end if;
  new.status := 'pending';
  new.decline_reason := null;
  new.responded_at := null;
  if new.surface <> 'other' then new.surface_other := null; end if;
  return new;
end $function$;

create or replace function public.on_trial_invite_insert()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_stage public.application_stage;
  v_club_name text;
begin
  if new.application_id is not null then
    select stage into v_stage from public.applications where id = new.application_id;
  end if;
  if new.application_id is not null and v_stage is distinct from 'trial' then
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
end $function$;

create or replace function public.enforce_trial_invite_update()
 returns trigger language plpgsql set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if new.application_id is distinct from old.application_id or new.club_id <> old.club_id
     or new.player_id <> old.player_id or new.vacancy_id is distinct from old.vacancy_id then
    raise exception 'Trial invite links cannot be changed';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  if v_uid = old.player_id and v_uid is distinct from old.club_id then
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
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'Clubs can only cancel a trial invitation';
    end if;
    new.decline_reason := old.decline_reason;
    new.responded_at := old.responded_at;
    if new.surface <> 'other' then new.surface_other := null; end if;
    return new;
  end if;

  raise exception 'Not allowed to update this trial invitation';
end $function$;