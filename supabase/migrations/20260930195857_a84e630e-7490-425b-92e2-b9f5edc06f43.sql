DROP POLICY IF EXISTS "Admins read all trial outcomes" ON public.trial_outcomes;
CREATE POLICY "Admins read all trial outcomes" ON public.trial_outcomes
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.trial_outcomes FROM anon;