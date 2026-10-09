CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.can_view_club(_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
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

REVOKE ALL ON FUNCTION private.can_view_club(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_club(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.can_view_club(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_club(uuid) TO service_role;

ALTER POLICY "Hide administrator Club rows from ordinary users"
ON public.clubs
USING (private.can_view_club(id));

ALTER POLICY "Hide administrator Club profiles from ordinary users"
ON public.profiles
USING (
  account_type <> 'club'::public.account_type
  OR private.can_view_club(id)
);

ALTER POLICY "Hide administrator Club vacancies from ordinary users"
ON public.vacancies
USING (private.can_view_club(club_id));

ALTER POLICY "Hide saved administrator Clubs from ordinary users"
ON public.saved_clubs
USING (private.can_view_club(club_id));

ALTER POLICY "Hide saved administrator Club vacancies from ordinary users"
ON public.saved_vacancies
USING (
  EXISTS (
    SELECT 1
    FROM public.vacancies v
    WHERE v.id = saved_vacancies.vacancy_id
      AND private.can_view_club(v.club_id)
  )
);

ALTER POLICY "Hide administrator Club applications from ordinary users"
ON public.applications
USING (private.can_view_club(club_id));

ALTER POLICY "Hide administrator Club trials from ordinary users"
ON public.trial_invites
USING (private.can_view_club(club_id));

ALTER POLICY "Hide administrator Club conversations from ordinary users"
ON public.conversations
USING (private.can_view_club(club_id));

DROP FUNCTION public.can_view_club(uuid);