CREATE OR REPLACE FUNCTION public.on_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conv public.conversations%rowtype;
  v_recipient uuid;
  v_sender_name text;
  v_preview text;
  v_muted boolean;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  v_recipient := case when new.sender_id = v_conv.club_id then v_conv.player_id else v_conv.club_id end;
  v_preview := left(new.body, 140);

  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = v_preview,
         last_message_sender_id = new.sender_id
   where id = new.conversation_id;

  select muted_at is not null into v_muted
  from public.conversation_participants
  where conversation_id = new.conversation_id and profile_id = v_recipient;
  if coalesce(v_muted, false) then
    return new;
  end if;

  if new.sender_id = v_conv.club_id then
    select name into v_sender_name from public.clubs where id = new.sender_id;
  end if;
  if v_sender_name is null then
    select display_name into v_sender_name from public.profiles where id = new.sender_id;
  end if;

  -- Each new message is its own event: always create a new notification
  -- (the push pipeline fires on notification INSERT).
  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  values (v_recipient, 'new_message',
          coalesce(v_sender_name, 'Someone') || ' sent you a message',
          v_preview, 'conversation', new.conversation_id);
  return new;
end $function$;