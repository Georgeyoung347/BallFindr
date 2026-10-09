ALTER TABLE public.players ADD COLUMN IF NOT EXISTS has_club boolean NOT NULL DEFAULT true;
GRANT SELECT (has_club), UPDATE (has_club) ON public.players TO authenticated;

UPDATE public.players SET has_club = false, level_id = NULL, current_club_name = 'Free Agent'
WHERE lower(regexp_replace(coalesce(current_club_name,''), '[^a-zA-Z]', '', 'g')) = 'freeagent';

CREATE OR REPLACE FUNCTION public.enforce_player_club_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if new.has_club = false then
    new.current_club_name := 'Free Agent';
    new.level_id := null;
  elsif lower(regexp_replace(coalesce(new.current_club_name,''), '[^a-zA-Z]', '', 'g')) = 'freeagent' then
    new.current_club_name := null;
  end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS enforce_player_club_status ON public.players;
CREATE TRIGGER enforce_player_club_status BEFORE INSERT OR UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.enforce_player_club_status();