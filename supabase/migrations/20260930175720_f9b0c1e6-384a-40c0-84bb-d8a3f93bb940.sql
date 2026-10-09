CREATE TABLE public.media_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('fire','thumbs_up','eyes')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, profile_id)
);
CREATE INDEX media_reactions_media_idx ON public.media_reactions(media_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_reactions TO authenticated;
GRANT ALL ON public.media_reactions TO service_role;
ALTER TABLE public.media_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reactions on visible media" ON public.media_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.media m WHERE m.id = media_id));

CREATE POLICY "React to others' visible media" ON public.media_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.media m WHERE m.id = media_id AND m.owner_profile_id <> auth.uid())
  );

CREATE POLICY "Change own reaction" ON public.media_reactions
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.media m WHERE m.id = media_id AND m.owner_profile_id <> auth.uid())
  );

CREATE POLICY "Remove own reaction" ON public.media_reactions
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

CREATE TRIGGER media_reactions_updated_at BEFORE UPDATE ON public.media_reactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();