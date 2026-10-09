CREATE TABLE public.email_reverifications (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_verified',
  token_hash text,
  sent_at timestamptz,
  sent_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_reverifications TO service_role;
ALTER TABLE public.email_reverifications ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.validate_email_reverification() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('not_verified','sent','reverified') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER email_reverifications_validate BEFORE INSERT OR UPDATE ON public.email_reverifications FOR EACH ROW EXECUTE FUNCTION public.validate_email_reverification();