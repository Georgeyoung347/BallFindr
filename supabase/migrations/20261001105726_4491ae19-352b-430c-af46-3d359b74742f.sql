CREATE OR REPLACE FUNCTION public.enforce_player_club_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
declare _fa boolean := lower(regexp_replace(coalesce(new.current_club_name,''), '[^a-zA-Z]', '', 'g')) = 'freeagent';
declare _explicit_no boolean := new.has_club = false and (tg_op = 'INSERT' or old.has_club is distinct from false);
begin
  if _fa or _explicit_no then
    new.has_club := false;
    new.current_club_name := 'Free Agent';
    new.level_id := null;
  else
    new.has_club := true;
  end if;
  return new;
end $$;