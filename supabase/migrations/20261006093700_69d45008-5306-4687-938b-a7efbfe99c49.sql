CREATE TABLE public.notification_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages boolean NOT NULL DEFAULT true,
  applications boolean NOT NULL DEFAULT true,
  trials boolean NOT NULL DEFAULT true,
  recruitment boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notification preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Users create own notification preferences" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users update own notification preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE TRIGGER set_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stage 1 gatekeeper + category preferences (no row = everything on).
CREATE OR REPLACE FUNCTION private.notification_before_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_hidden boolean; v_existing uuid; v_pref public.notification_preferences%rowtype; v_allowed boolean;
begin
  if new.type <> 'admin_warning' then
    if private.is_restricted(new.recipient_profile_id) then return null; end if;
    if new.type <> 'new_message' then
      select is_hidden into v_hidden from public.profiles where id = new.recipient_profile_id;
      if coalesce(v_hidden, false) then return null; end if;
    end if;
  end if;

  -- User category preferences (account/security/admin types are never in a category)
  select * into v_pref from public.notification_preferences where profile_id = new.recipient_profile_id;
  if found then
    v_allowed := case
      when new.type = 'new_message' then v_pref.messages
      when new.type in ('new_interest','stage_change','application_withdrawn') then v_pref.applications
      when new.type in ('trial_invite','trial_response','trial_cancelled','trial_outcome') then v_pref.trials
      when new.type in ('saved_club_new_vacancy','saved_club_vacancy_closed','saved_club_vacancy_updated',
                        'saved_player_availability','media_reaction') then v_pref.recruitment
      else true end;
    if not v_allowed then return null; end if;
  end if;

  if new.type in ('media_reaction','saved_club_vacancy_updated','saved_player_availability','stage_change','new_interest','application_withdrawn')
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
end $function$;