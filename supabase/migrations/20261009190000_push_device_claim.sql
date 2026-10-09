-- One phone, one account for push.
--
-- push_devices is unique per (user_id, token), and a row was only deactivated
-- by an explicit sign-out on the device. If account A's session ended any
-- other way (expired session, reinstall, cleared storage) and account B then
-- signed in on the same phone, both rows stayed active and the phone received
-- A's pushes too. Owner-only RLS means B's client cannot touch A's row, so the
-- claim runs as SECURITY DEFINER: it deactivates every other account's row for
-- this token and upserts the caller's row as active.

CREATE OR REPLACE FUNCTION public.claim_push_device(_token text, _platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  -- Same rules as the table's CHECK constraints, with a clear error.
  IF _token IS NULL OR char_length(_token) NOT BETWEEN 1 AND 4096 THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;
  IF _platform IS NULL OR _platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'Invalid platform' USING ERRCODE = '22023';
  END IF;

  UPDATE public.push_devices
     SET is_active = false,
         updated_at = v_now
   WHERE token = _token
     AND user_id <> v_uid
     AND is_active;

  INSERT INTO public.push_devices (user_id, token, platform, is_active, last_seen_at, updated_at)
  VALUES (v_uid, _token, _platform, true, v_now, v_now)
  ON CONFLICT (user_id, token) DO UPDATE
     SET platform = EXCLUDED.platform,
         is_active = true,
         last_seen_at = EXCLUDED.last_seen_at,
         updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_device(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_device(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_push_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_device(text, text) TO service_role;
