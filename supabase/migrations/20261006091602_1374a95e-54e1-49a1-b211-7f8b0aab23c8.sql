-- Stage 2: missing notification events (reuse existing notifications table + Stage 1 insert trigger)

CREATE OR REPLACE FUNCTION public.on_trial_invite_response()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  elsif new.status is distinct from old.status and new.status = 'cancelled'
        and auth.uid() is distinct from new.player_id then
    select name into v_name from public.clubs where id = new.club_id;
    insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
    values (new.player_id, 'trial_cancelled',
            coalesce(v_name, 'A club') || ' has cancelled your trial invitation',
            public.trial_invite_summary(new),
            'trial_invite', new.id);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.on_application_stage_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_invite public.trial_invites%rowtype;
  v_club_name text;
begin
  if new.stage is distinct from old.stage then
    insert into public.application_events (application_id, from_stage, to_stage, actor_profile_id)
    values (new.id, old.stage, new.stage, auth.uid());

    -- Player withdrew: tell the club (no self-notification).
    if auth.uid() = new.player_id and new.stage = 'withdrawn' then
      insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
      select new.club_id, 'application_withdrawn',
             pr.display_name || ' has withdrawn their interest',
             coalesce(v.title, 'Vacancy'), 'application', new.id
      from public.profiles pr, public.vacancies v
      where pr.id = new.player_id and v.id = new.vacancy_id;
      return new;
    end if;

    if auth.uid() = new.player_id and old.stage = 'withdrawn' and new.stage = 'interested' then
      insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
      select new.club_id, 'new_interest', pr.display_name || ' is interested in your vacancy',
             coalesce(v.title, 'Vacancy'), 'application', new.id
      from public.profiles pr, public.vacancies v
      where pr.id = new.player_id and v.id = new.vacancy_id;
      return new;
    end if;

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
              public.trial_invite_summary(v_invite), 'trial_invite', v_invite.id);
    else
      insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
      values (new.player_id, 'stage_change', 'Application update: ' || new.stage,
              coalesce(v_club_name, 'A club') || ' moved your application to ' || new.stage,
              'application', new.id);
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.on_trial_outcome_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_club text;
begin
  select name into v_club from public.clubs where id = new.club_id;
  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  values (new.player_id, 'trial_outcome',
          case when new.outcome = 'signed'
               then coalesce(v_club, 'A club') || ' has signed you after your trial'
               else coalesce(v_club, 'A club') || ' has recorded your trial as Not Signed' end,
          null, 'trial_invite', new.trial_invite_id);
  return new;
end $function$;
REVOKE EXECUTE ON FUNCTION public.on_trial_outcome_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_trial_outcome_insert AFTER INSERT ON public.trial_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.on_trial_outcome_insert();

-- Stage 1 duplicate protection: repeated withdraw/reapply cycles refresh the unread row.
CREATE OR REPLACE FUNCTION private.notification_before_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_hidden boolean; v_existing uuid;
begin
  if new.type <> 'admin_warning' then
    if private.is_restricted(new.recipient_profile_id) then return null; end if;
    if new.type <> 'new_message' then
      select is_hidden into v_hidden from public.profiles where id = new.recipient_profile_id;
      if coalesce(v_hidden, false) then return null; end if;
    end if;
  end if;

  if new.type in ('media_reaction','saved_club_vacancy_updated','saved_player_availability','stage_change','new_interest','application_withdrawn')
     and new.entity_id is not null then
    select id into v_existing from public.notifications n
     where n.recipient_profile_id = new.recipient_profile_id
       and n.type = new.type
       and n.entity_type is not distinct from new.entity_type
       and n.entity_id = new.entity_id
       and n.read_at is null
       and (new.type <> 'media_reaction'
            or split_part(n.title, ' reacted ', 1) = split_part(new.title, ' reacted ', 1))
     order by n.created_at desc limit 1;
    if v_existing is not null then
      update public.notifications
         set title = new.title, body = new.body, created_at = now()
       where id = v_existing;
      return null;
    end if;
  end if;
  return new;
end $function$;