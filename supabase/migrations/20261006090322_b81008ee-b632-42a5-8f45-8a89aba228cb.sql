REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM authenticated, anon;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION private.notification_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_hidden boolean; v_existing uuid;
begin
  -- Recipient eligibility (staff warnings always delivered)
  if new.type <> 'admin_warning' then
    if private.is_restricted(new.recipient_profile_id) then return null; end if;
    if new.type <> 'new_message' then
      select is_hidden into v_hidden from public.profiles where id = new.recipient_profile_id;
      if coalesce(v_hidden, false) then return null; end if;
    end if;
  end if;

  -- Collapse repeated, non-meaningful events into the existing unread notification
  if new.type in ('media_reaction','saved_club_vacancy_updated','saved_player_availability','stage_change','new_interest')
     and new.entity_id is not null then
    select id into v_existing from public.notifications n
     where n.recipient_profile_id = new.recipient_profile_id
       and n.type = new.type
       and n.entity_type is not distinct from new.entity_type
       and n.entity_id = new.entity_id
       and n.read_at is null
       and (new.type <> 'media_reaction'
            or split_part(n.title, ' reacted ', 1) = split_part(new.title, ' reacted ', 1))
     order by n.created_at desc limit 1;
    if v_existing is not null then
      update public.notifications
         set title = new.title, body = new.body, created_at = now()
       where id = v_existing;
      return null;
    end if;
  end if;
  return new;
end $$;
REVOKE ALL ON FUNCTION private.notification_before_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notifications_before_insert
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION private.notification_before_insert();