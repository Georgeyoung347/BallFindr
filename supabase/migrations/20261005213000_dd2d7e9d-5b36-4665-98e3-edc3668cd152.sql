CREATE OR REPLACE FUNCTION public.record_trial_outcome(_invite_id uuid, _outcome text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.trial_invites%ROWTYPE;
  existing public.trial_outcomes%ROWTYPE;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT private.profile_is_type(auth.uid(), 'club') THEN RAISE EXCEPTION 'Only a club account can record a trial outcome'; END IF;
  IF _outcome NOT IN ('signed','not_signed') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  SELECT * INTO inv FROM public.trial_invites WHERE id = _invite_id;
  IF NOT FOUND OR inv.club_id <> auth.uid() THEN RAISE EXCEPTION 'Trial invitation not found'; END IF;
  IF inv.status = 'cancelled' THEN RAISE EXCEPTION 'This trial invitation was cancelled'; END IF;
  SELECT * INTO existing FROM public.trial_outcomes WHERE trial_invite_id = _invite_id;
  IF FOUND THEN RAISE EXCEPTION 'An outcome has already been recorded for this trial'; END IF;
  IF _outcome = 'signed' AND EXISTS (
    SELECT 1 FROM public.trial_outcomes o
    WHERE o.outcome = 'signed' AND o.club_id = inv.club_id AND o.player_id = inv.player_id
      AND o.vacancy_id IS NOT DISTINCT FROM inv.vacancy_id
  ) THEN RAISE EXCEPTION 'This player is already recorded as signed'; END IF;
  INSERT INTO public.trial_outcomes (trial_invite_id, club_id, player_id, vacancy_id, outcome, recorded_by)
  VALUES (inv.id, inv.club_id, inv.player_id, inv.vacancy_id, _outcome, auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$;