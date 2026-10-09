
-- Moderator permission helpers (is_admin() is unchanged and still admin-only).
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'moderator'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.can_moderate()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR public.is_moderator()
$$;

CREATE OR REPLACE FUNCTION public.my_staff_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_admin() THEN 'admin' WHEN public.is_moderator() THEN 'moderator' ELSE NULL END
$$;

-- Whether a moderator may act on a target: never themselves, never staff.
CREATE OR REPLACE FUNCTION private.moderator_may_target(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _profile_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _profile_id)
$$;

-- Moderator-visible action types in the history log.
CREATE OR REPLACE FUNCTION private.is_moderation_action(_action text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _action IN ('warning_issued','profile_hidden','profile_unhidden')
      OR _action LIKE 'report\_%' OR _action LIKE 'restriction\_%'
$$;

REVOKE EXECUTE ON FUNCTION public.is_moderator(), public.can_moderate(), public.my_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_moderator(), public.can_moderate(), public.my_staff_role() TO authenticated;

-- Moderators can review restricted profiles and both sections while investigating.
CREATE OR REPLACE FUNCTION private.account_visible(_profile_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select _profile_id is null or auth.uid() = _profile_id or public.can_moderate()
      or not private.is_restricted(_profile_id)
$$;
CREATE OR REPLACE FUNCTION private.section_visible(_section football_section)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  SELECT _section IS NULL OR _section = 'both' OR public.can_moderate()
      OR private.my_section() IS NULL OR private.my_section() = _section
$$;

-- Reports: admins and moderators.
DROP POLICY IF EXISTS "Admins can see every report" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Staff can see every report" ON public.reports FOR SELECT TO authenticated USING (public.can_moderate());
CREATE POLICY "Staff can update reports" ON public.reports FOR UPDATE TO authenticated USING (public.can_moderate()) WITH CHECK (public.can_moderate());

CREATE OR REPLACE FUNCTION public.enforce_report_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if not public.can_moderate() then
    raise exception 'Only an administrator or moderator can change a report';
  end if;
  if new.reporter_profile_id is distinct from old.reporter_profile_id
     or new.reported_profile_id is distinct from old.reported_profile_id
     or new.kind is distinct from old.kind or new.reason is distinct from old.reason
     or new.details is distinct from old.details or new.message_id is distinct from old.message_id
     or new.conversation_id is distinct from old.conversation_id
     or new.message_body is distinct from old.message_body
     or new.message_sent_at is distinct from old.message_sent_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Report evidence cannot be changed';
  end if;
  return new;
end $function$;

-- Restrictions: admins any; moderators temporary only, never on themselves or staff.
DROP POLICY IF EXISTS "Only admins create restrictions" ON public.account_restrictions;
DROP POLICY IF EXISTS "Admins read every restriction" ON public.account_restrictions;
DROP POLICY IF EXISTS "Only admins change restrictions" ON public.account_restrictions;
CREATE POLICY "Staff read every restriction" ON public.account_restrictions FOR SELECT TO authenticated USING (public.can_moderate());
CREATE POLICY "Staff create restrictions" ON public.account_restrictions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_moderator() AND kind = 'temporary' AND private.moderator_may_target(profile_id)));
CREATE POLICY "Staff change restrictions" ON public.account_restrictions FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_moderator() AND kind = 'temporary' AND private.moderator_may_target(profile_id)))
  WITH CHECK (public.is_admin() OR (public.is_moderator() AND kind = 'temporary' AND private.moderator_may_target(profile_id)));

-- Moderation log: admins read all; moderators read moderation actions only; nobody edits/deletes.
DROP POLICY IF EXISTS "Admins read the moderation log" ON public.moderation_actions;
DROP POLICY IF EXISTS "Admins write the moderation log" ON public.moderation_actions;
CREATE POLICY "Admins read the moderation log" ON public.moderation_actions FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Moderators read moderation entries" ON public.moderation_actions FOR SELECT TO authenticated
  USING (public.is_moderator() AND private.is_moderation_action(action));
CREATE POLICY "Staff write the moderation log" ON public.moderation_actions FOR INSERT TO authenticated
  WITH CHECK (admin_profile_id = auth.uid() AND (public.is_admin() OR (public.is_moderator() AND private.is_moderation_action(action))));

-- Hidden status: only via the admin/moderator RPC (flag) or an admin.
CREATE OR REPLACE FUNCTION public.protect_hidden_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if new.is_hidden is distinct from old.is_hidden and not public.is_admin()
     and coalesce(current_setting('ballfindr.moderation_rpc', true), '') <> 'on' then
    raise exception 'Profile visibility can only be changed by an administrator or moderator';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_hidden(_profile_id uuid, _hidden boolean)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  _caller uuid := auth.uid();
  _type public.account_type; _old boolean; _name text; _admin_name text;
begin
  if _caller is null or not public.can_moderate() then
    raise exception 'Forbidden: administrator or moderator access required' using errcode = '42501';
  end if;
  if not public.is_admin() and not private.moderator_may_target(_profile_id) then
    raise exception 'Moderators cannot change the visibility of their own or another staff account' using errcode = '42501';
  end if;
  select account_type, is_hidden, display_name into _type, _old, _name from public.profiles where id = _profile_id for update;
  if _type is null then raise exception 'Account not found'; end if;
  if _old = _hidden then return _hidden; end if;
  perform set_config('ballfindr.moderation_rpc', 'on', true);
  update public.profiles set is_hidden = _hidden where id = _profile_id;
  perform set_config('ballfindr.moderation_rpc', 'off', true);
  select display_name into _admin_name from public.profiles where id = _caller;
  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, previous_status, new_status, subject_display_name, admin_display_name, note)
  values (_caller, case when _hidden then 'profile_hidden' else 'profile_unhidden' end, _profile_id,
          case when _old then 'hidden' else 'visible' end, case when _hidden then 'hidden' else 'visible' end,
          _name, _admin_name, format('%s profile %s by %s', initcap(_type::text), case when _hidden then 'hidden' else 'unhidden' end,
          case when public.is_admin() then 'admin' else 'moderator' end));
  return _hidden;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_issue_warning(_profile_id uuid, _message text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  _caller uuid := auth.uid();
  _type public.account_type;
  _name text; _admin_name text; _msg text := btrim(coalesce(_message, '')); _id uuid;
begin
  if _caller is null or not public.can_moderate() then
    raise exception 'Forbidden: administrator or moderator access required' using errcode = '42501';
  end if;
  if not public.is_admin() and not private.moderator_may_target(_profile_id) then
    raise exception 'Moderators cannot warn their own or another staff account' using errcode = '42501';
  end if;
  if char_length(_msg) = 0 then raise exception 'A warning message is required'; end if;
  if char_length(_msg) > 1000 then raise exception 'Warning message is too long (max 1000 characters)'; end if;
  select account_type, display_name into _type, _name from public.profiles where id = _profile_id;
  if _type is null then raise exception 'Account not found'; end if;
  select display_name into _admin_name from public.profiles where id = _caller;
  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, new_status, subject_display_name, admin_display_name, note)
  values (_caller, 'warning_issued', _profile_id, _type::text, _name, _admin_name, _msg)
  returning id into _id;
  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  values (_profile_id, 'admin_warning', 'You have received a warning from BallFindr', _msg, null, null);
  return _id;
end $function$;

-- Role management: one role per account (admin / moderator / none). Admin-only.
CREATE OR REPLACE FUNCTION public.admin_set_role(_profile_id uuid, _role text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  _caller uuid := auth.uid();
  _old text; _admin_count int; _subject_name text; _admin_name text;
begin
  if _caller is null or not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  if _role not in ('admin', 'moderator', 'none') then raise exception 'Unknown role'; end if;
  if not exists (select 1 from public.profiles where id = _profile_id) then raise exception 'Account not found'; end if;

  lock table public.user_roles in share row exclusive mode;

  select case when bool_or(role = 'admin') then 'admin' when bool_or(role = 'moderator') then 'moderator' else 'none' end
    into _old from public.user_roles where user_id = _profile_id;
  _old := coalesce(_old, 'none');
  if _old = _role then return _role; end if;

  if _old = 'admin' then
    select count(*) into _admin_count from public.user_roles where role = 'admin';
    if _admin_count <= 1 then
      raise exception 'You cannot remove the last remaining administrator';
    end if;
  end if;

  delete from public.user_roles where user_id = _profile_id and role in ('admin', 'moderator');
  if _role <> 'none' then
    insert into public.user_roles (user_id, role) values (_profile_id, _role::public.app_role);
  end if;

  select display_name into _subject_name from public.profiles where id = _profile_id;
  select display_name into _admin_name from public.profiles where id = _caller;
  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, previous_status, new_status, subject_display_name, admin_display_name, note)
  values (_caller,
    case when _role = 'admin' then 'admin_granted' when _role = 'moderator' then 'moderator_granted'
         when _old = 'admin' then 'admin_removed' else 'moderator_removed' end,
    _profile_id, _old, _role, _subject_name, _admin_name,
    format('Role changed from %s to %s', _old, _role));
  return _role;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_roles()
 RETURNS TABLE(user_id uuid, role text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  return query select ur.user_id, ur.role::text from public.user_roles ur where ur.role in ('admin', 'moderator');
end $function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text), public.admin_list_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text), public.admin_list_roles() TO authenticated;
