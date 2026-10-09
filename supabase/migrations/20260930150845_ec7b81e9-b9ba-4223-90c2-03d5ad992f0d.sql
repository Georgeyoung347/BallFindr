alter table public.profiles add column if not exists is_hidden boolean not null default false;

create or replace function public.protect_hidden_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_hidden is distinct from old.is_hidden and not public.is_admin() then
    raise exception 'Profile visibility can only be changed by an administrator';
  end if;
  return new;
end $$;
revoke all on function public.protect_hidden_status() from public, anon, authenticated;
create trigger protect_hidden_status before update on public.profiles
  for each row execute function public.protect_hidden_status();

create or replace view public.player_cards with (security_invoker = true) as
 SELECT p.id, pr.display_name, pr.avatar_path, pr.cover_path, d.location, d.bio, d.looking_for,
    d.preferred_training_days, d.max_travel_miles, p.current_club_name, p.level_id, l.name AS level_name,
    p.preferred_level_id, pl.name AS preferred_level_name, p.primary_position, p.secondary_positions,
    p.availability, p.open_to_trials, p.height_inches, player_age(p.id) AS age, p.created_at, p.updated_at,
    p.football_section, pr.is_hidden
   FROM players p
     JOIN profiles pr ON pr.id = p.id
     LEFT JOIN levels l ON l.id = p.level_id
     LEFT JOIN levels pl ON pl.id = p.preferred_level_id
     LEFT JOIN LATERAL player_details(p.id) d(location, bio, looking_for, preferred_training_days, max_travel_miles) ON true
  WHERE auth.uid() IS NOT NULL;

create or replace function public.admin_issue_warning(_profile_id uuid, _message text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  _caller uuid := auth.uid();
  _type public.account_type;
  _name text; _admin_name text; _msg text := btrim(coalesce(_message, '')); _id uuid;
begin
  if _caller is null or not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
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
end $$;

create or replace function public.admin_set_profile_hidden(_profile_id uuid, _hidden boolean)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  _caller uuid := auth.uid();
  _type public.account_type; _old boolean; _name text; _admin_name text;
begin
  if _caller is null or not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  select account_type, is_hidden, display_name into _type, _old, _name from public.profiles where id = _profile_id for update;
  if _type is null then raise exception 'Account not found'; end if;
  if _old = _hidden then return _hidden; end if;
  update public.profiles set is_hidden = _hidden where id = _profile_id;
  select display_name into _admin_name from public.profiles where id = _caller;
  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, previous_status, new_status, subject_display_name, admin_display_name, note)
  values (_caller, case when _hidden then 'profile_hidden' else 'profile_unhidden' end, _profile_id,
          case when _old then 'hidden' else 'visible' end, case when _hidden then 'hidden' else 'visible' end,
          _name, _admin_name, format('%s profile %s by admin', initcap(_type::text), case when _hidden then 'hidden' else 'unhidden' end));
  return _hidden;
end $$;

revoke all on function public.admin_issue_warning(uuid, text) from public, anon;
revoke all on function public.admin_set_profile_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_issue_warning(uuid, text) to authenticated;
grant execute on function public.admin_set_profile_hidden(uuid, boolean) to authenticated;