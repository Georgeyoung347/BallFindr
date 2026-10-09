CREATE OR REPLACE FUNCTION public.enforce_application_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
declare v_uid uuid := auth.uid();
begin
  -- Only member edits by the involved player/club are constrained.
  if v_uid is null or (v_uid <> old.player_id and v_uid <> old.club_id) then
    return new;
  end if;
  if new.player_id is distinct from old.player_id
     or new.club_id is distinct from old.club_id
     or new.vacancy_id is distinct from old.vacancy_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Application player, club, vacancy and created date cannot be changed';
  end if;
  if new.stage is distinct from old.stage then
    if v_uid = old.player_id then
      if not ((new.stage = 'withdrawn' and old.stage not in ('withdrawn','rejected','accepted'))
              or (old.stage = 'withdrawn' and new.stage = 'interested')) then
        raise exception 'Players can only withdraw or reapply to an application';
      end if;
    else
      if new.stage not in ('reviewing','shortlisted','trial','accepted','rejected') then
        raise exception 'Clubs cannot set this application status';
      end if;
    end if;
  end if;
  return new;
end $$;

CREATE TRIGGER enforce_application_update
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_application_update();