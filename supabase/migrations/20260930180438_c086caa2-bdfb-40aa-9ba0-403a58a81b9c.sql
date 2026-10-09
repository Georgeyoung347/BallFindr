CREATE OR REPLACE FUNCTION public.on_media_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_owner uuid; v_kind public.media_kind; v_name text; v_emoji text;
begin
  if tg_op = 'UPDATE' and new.reaction is not distinct from old.reaction then return new; end if;
  select owner_profile_id, kind into v_owner, v_kind from public.media where id = new.media_id;
  if v_owner is null or v_owner = new.profile_id then return new; end if;
  select name into v_name from public.clubs where id = new.profile_id;
  if v_name is null then select display_name into v_name from public.profiles where id = new.profile_id; end if;
  v_emoji := case new.reaction when 'fire' then '🔥' when 'thumbs_up' then '👍' else '👀' end;
  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  values (v_owner, 'media_reaction',
          coalesce(v_name, 'Someone') || ' reacted ' || v_emoji || ' to your ' || case when v_kind = 'video' then 'clip' else 'photo' end || '.',
          null, 'media', new.media_id);
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.on_media_reaction() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_media_reaction AFTER INSERT OR UPDATE ON public.media_reactions
  FOR EACH ROW EXECUTE FUNCTION public.on_media_reaction();