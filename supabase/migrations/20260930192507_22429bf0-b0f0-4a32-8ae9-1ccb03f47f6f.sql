CREATE TABLE public.trial_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_invite_id uuid NOT NULL UNIQUE REFERENCES public.trial_invites(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  vacancy_id uuid REFERENCES public.vacancies(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('signed','not_signed')),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- One successful connection per club/player/vacancy (or per club/player for direct invites)
CREATE UNIQUE INDEX trial_outcomes_signed_unique
  ON public.trial_outcomes (club_id, player_id, COALESCE(vacancy_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE outcome = 'signed';
CREATE INDEX trial_outcomes_club_idx ON public.trial_outcomes (club_id);

GRANT SELECT ON public.trial_outcomes TO authenticated;
GRANT ALL ON public.trial_outcomes TO service_role;
ALTER TABLE public.trial_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club and player read own trial outcomes" ON public.trial_outcomes
  FOR SELECT TO authenticated USING (auth.uid() = club_id OR auth.uid() = player_id);
CREATE POLICY "Admins read all trial outcomes" ON public.trial_outcomes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Only way to write: the club that sent the invite records the outcome once.
CREATE OR REPLACE FUNCTION public.record_trial_outcome(_invite_id uuid, _outcome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.trial_invites%ROWTYPE;
  existing public.trial_outcomes%ROWTYPE;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.record_trial_outcome(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_trial_outcome(uuid, text) TO authenticated;