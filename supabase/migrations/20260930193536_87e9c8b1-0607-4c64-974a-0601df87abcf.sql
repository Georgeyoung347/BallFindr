CREATE OR REPLACE FUNCTION public.enforce_trial_invite_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
      if old.status = 'pending'
         and (old.trial_date + old.start_time) <= (now() at time zone 'Europe/London') then
        raise exception 'This trial invitation has passed';
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