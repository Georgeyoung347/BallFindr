-- Versioned change: tighten ONLY the "Involved player or club can update an application" UPDATE policy
-- on public.applications. Every other policy, function, trigger and table stays untouched.

ALTER POLICY "Involved player or club can update an application"
  ON public.applications
  WITH CHECK (
    (auth.uid() = player_id AND private.profile_is_type(auth.uid(), 'player'::account_type))
    OR
    (auth.uid() = club_id AND private.profile_is_type(auth.uid(), 'club'::account_type))
  );