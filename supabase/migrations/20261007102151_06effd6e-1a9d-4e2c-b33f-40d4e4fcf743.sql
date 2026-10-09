REVOKE ALL ON public.push_devices FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.push_devices FROM authenticated;