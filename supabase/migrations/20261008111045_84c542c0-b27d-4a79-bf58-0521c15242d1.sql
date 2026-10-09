CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_hook_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_hook_secret', 'Internal: authorises notification->push hook');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.push_hook_secret_ok(_s text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT coalesce(_s <> '' AND _s = (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret'), false)
$$;
REVOKE ALL ON FUNCTION public.push_hook_secret_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_hook_secret_ok(text) TO service_role;

CREATE OR REPLACE FUNCTION public.notifications_after_insert_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, extensions AS $$
DECLARE v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret';
    IF v_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://rnkybpumgsihkwfwexsv.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object('Content-Type','application/json','x-push-hook-secret', v_secret),
        body := jsonb_build_object('notification_id', NEW.id),
        timeout_milliseconds := 10000
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never break the in-app notification
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notifications_after_insert_push() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notifications_after_insert_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_after_insert_push();