ALTER POLICY "Clubs create trial invites for their own applications"
  ON public.trial_invites
  WITH CHECK (
    auth.uid() = club_id
    AND EXISTS (
      SELECT 1
      FROM applications a
      WHERE a.id = trial_invites.application_id
        AND a.club_id = auth.uid()
    )
    AND private.profile_is_type(auth.uid(), 'club')
  );