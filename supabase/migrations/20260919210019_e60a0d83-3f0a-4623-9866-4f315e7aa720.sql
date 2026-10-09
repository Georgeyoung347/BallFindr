CREATE OR REPLACE FUNCTION public.can_view_club(_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      auth.uid() = _club_id
      OR public.is_admin()
      OR NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _club_id
          AND ur.role = 'admin'::public.app_role
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_view_club(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_club(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_club(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_club(uuid) TO service_role;

CREATE POLICY "Hide administrator Club rows from ordinary users"
ON public.clubs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_view_club(id));

CREATE POLICY "Hide administrator Club profiles from ordinary users"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  account_type <> 'club'::public.account_type
  OR public.can_view_club(id)
);

CREATE POLICY "Hide administrator Club vacancies from ordinary users"
ON public.vacancies
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_view_club(club_id));

CREATE POLICY "Hide saved administrator Clubs from ordinary users"
ON public.saved_clubs
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_view_club(club_id));

CREATE POLICY "Hide saved administrator Club vacancies from ordinary users"
ON public.saved_vacancies
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vacancies v
    WHERE v.id = saved_vacancies.vacancy_id
      AND public.can_view_club(v.club_id)
  )
);

CREATE POLICY "Hide administrator Club applications from ordinary users"
ON public.applications
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_view_club(club_id));

CREATE POLICY "Hide administrator Club trials from ordinary users"
ON public.trial_invites
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_view_club(club_id));

CREATE POLICY "Hide administrator Club conversations from ordinary users"
ON public.conversations
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.can_view_club(club_id));