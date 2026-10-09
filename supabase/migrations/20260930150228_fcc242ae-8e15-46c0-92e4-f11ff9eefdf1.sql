create or replace function public.admin_set_football_section(_profile_id uuid, _section public.football_section)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _type public.account_type;
  _old public.football_section;
  _subject_name text;
  _admin_name text;
  _label text;
begin
  if _caller is null or not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  select account_type, display_name into _type, _subject_name from public.profiles where id = _profile_id;
  if _type is null then raise exception 'Account not found'; end if;

  if _type = 'player' then
    if _section = 'both' then raise exception 'Players can only be Men''s or Women''s'; end if;
    select football_section into _old from public.players where id = _profile_id for update;
    if _old is null then raise exception 'Player record not found'; end if;
    if _old = _section then return _old::text; end if;
    update public.players set football_section = _section where id = _profile_id;
  else
    select football_section into _old from public.clubs where id = _profile_id for update;
    if _old is null then raise exception 'Club record not found'; end if;
    if _old = _section then return _old::text; end if;
    -- enforce_club_section keeps active_section valid for the new value.
    update public.clubs set football_section = _section where id = _profile_id;
  end if;

  select display_name into _admin_name from public.profiles where id = _caller;
  _label := case _type when 'club' then 'football sections' else 'football section' end;

  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, previous_status, new_status,
     subject_display_name, admin_display_name, note)
  values
    (_caller, 'section_changed', _profile_id, _old::text, _section::text,
     _subject_name, _admin_name,
     format('Admin changed %s''s %s (%s account)', _subject_name, _label, _type));

  return _section::text;
end $$;

revoke all on function public.admin_set_football_section(uuid, public.football_section) from public, anon;
grant execute on function public.admin_set_football_section(uuid, public.football_section) to authenticated;