ALTER TABLE public.profiles ADD COLUMN is_owner boolean NOT NULL DEFAULT false;
GRANT SELECT (is_owner) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.protect_owner_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_owner IS DISTINCT FROM OLD.is_owner AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Owner Status can only be changed by an administrator';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_owner_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_owner_status BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_status();