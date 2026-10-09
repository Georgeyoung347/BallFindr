CREATE TABLE public.push_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL CHECK (char_length(token) BETWEEN 1 AND 4096),
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
CREATE INDEX push_devices_user_active_idx ON public.push_devices (user_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own devices" ON public.push_devices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners add own devices" ON public.push_devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own devices" ON public.push_devices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners remove own devices" ON public.push_devices FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER push_devices_set_updated_at BEFORE UPDATE ON public.push_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();