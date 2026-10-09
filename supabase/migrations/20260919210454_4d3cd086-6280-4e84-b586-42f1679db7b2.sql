DO $$
DECLARE
  v_admin uuid := '4b04a7a0-4882-4d8c-851f-6a678d254930'::uuid;
  v_player uuid := '93e3be10-f714-4723-a35a-d928794471bd'::uuid;
  v_club uuid := '7480af07-3bbd-4504-9248-45b65ccf46f8'::uuid;
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  PERFORM set_config('request.jwt.claim.sub', v_player::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.clubs WHERE id = v_admin;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ordinary player can read administrator Club'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_admin;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ordinary player can read administrator Club profile'; END IF;
  SELECT count(*) INTO v_count FROM public.clubs WHERE id = v_club;
  IF v_count <> 1 THEN RAISE EXCEPTION 'ordinary player cannot read normal Club'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_club::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.clubs WHERE id = v_admin;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ordinary Club can read administrator Club'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_admin;
  IF v_count <> 0 THEN RAISE EXCEPTION 'ordinary Club can read administrator Club profile'; END IF;
  SELECT count(*) INTO v_count FROM public.clubs WHERE id = v_club;
  IF v_count <> 1 THEN RAISE EXCEPTION 'ordinary Club cannot read its own Club'; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.clubs WHERE id = v_admin;
  IF v_count <> 1 THEN RAISE EXCEPTION 'administrator cannot read own Club'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = v_admin;
  IF v_count <> 1 THEN RAISE EXCEPTION 'administrator cannot read own profile'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'administrator permission no longer works'; END IF;
  RESET ROLE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clubs c
    JOIN public.profiles p ON p.id = c.id
    JOIN public.user_roles ur ON ur.user_id = c.id AND ur.role = 'admin'::public.app_role
    WHERE c.id = v_admin AND p.account_type = 'club'::public.account_type
  ) THEN
    RAISE EXCEPTION 'administrator Club account or role was changed';
  END IF;
END
$$;