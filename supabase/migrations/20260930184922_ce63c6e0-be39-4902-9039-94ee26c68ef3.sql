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

    -- Player withdrew: no self-notification.
    if auth.uid() = new.player_id and new.stage = 'withdrawn' then
      return new;
    end if;

    -- Player re-registered interest after withdrawing: tell the club, like a new application.
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