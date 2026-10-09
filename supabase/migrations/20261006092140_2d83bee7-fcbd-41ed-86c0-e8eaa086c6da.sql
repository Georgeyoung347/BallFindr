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
            coalesce(v_name, 'A player') ||
              case when old.status = 'accepted' and new.status = 'declined'
                   then ' has withdrawn from your trial'
                   else ' has ' || new.status::text || ' your trial invitation' end,
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