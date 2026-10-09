create or replace function public.prevent_account_type_change()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.account_type is distinct from old.account_type then
    if coalesce(current_setting('ballfindr.account_type_rpc', true), 'off') = 'on' and public.is_admin() then
      null; -- admin_switch_account_type only
    elsif current_setting('role', true) in ('authenticated', 'anon') or auth.uid() is not null then
      raise exception 'Account type cannot be changed';
    end if;
  end if;
  new.id := old.id;
  return new;
end $$;

create or replace function private.profile_is_type(_id uuid, _t public.account_type)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = _id and account_type = _t)
$$;
grant execute on function private.profile_is_type(uuid, public.account_type) to authenticated;

create policy "Only active player records" on public.players as restrictive for select to authenticated
  using (auth.uid() = id or public.can_moderate() or private.profile_is_type(id, 'player'));
create policy "Only active club records" on public.clubs as restrictive for select to authenticated
  using (auth.uid() = id or public.can_moderate() or private.profile_is_type(id, 'club'));
create policy "Only active club vacancies" on public.vacancies as restrictive for select to authenticated
  using (auth.uid() = club_id or public.can_moderate() or private.profile_is_type(club_id, 'club'));

create or replace function public.admin_switch_account_type(_profile_id uuid, _to public.account_type)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  _caller uuid := auth.uid();
  _old public.account_type;
  _name text; _admin_name text;
  _sec public.football_section;
begin
  if _caller is null or not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  select account_type, display_name into _old, _name from public.profiles where id = _profile_id for update;
  if _old is null then raise exception 'Account not found'; end if;
  if _old = _to then raise exception 'Account is already a %', initcap(_to::text); end if;

  delete from public.achievements where profile_id = _profile_id;
  delete from public.media where owner_profile_id = _profile_id;

  if _old = 'player' then
    select football_section into _sec from public.players where id = _profile_id;
    _sec := coalesce(_sec, 'mens');
    delete from public.player_history where player_id = _profile_id;
    delete from public.saved_clubs where player_id = _profile_id;
    delete from public.saved_vacancies where player_id = _profile_id;
    delete from public.saved_players where player_id = _profile_id;
    delete from public.player_private where player_id = _profile_id;
    update public.players set location = null, current_club_name = null, level_id = null,
      primary_position = null, secondary_positions = null, preferred_level_id = null,
      availability = 'not_looking', preferred_training_days = null, max_travel_miles = null,
      open_to_trials = false, bio = null, looking_for = null, height_inches = null
    where id = _profile_id;
    -- Blank Club profile (reuse leftover row if the account was a club before).
    delete from public.club_history where club_id = _profile_id;
    insert into public.clubs (id, name, football_section, active_section)
    values (_profile_id, _name, _sec, _sec)
    on conflict (id) do update set name = excluded.name, short_name = null, badge_path = null,
      location = null, home_ground = null, league = null, level_id = null, founded = null,
      description = null, training_days = null, training_location = null, training_time = null,
      match_day = null, contact_name = null, contact_role = null, contact_email = null,
      recruitment_status = 'open', team_photo_path = null, home_ground_photo_path = null,
      training_pitch_photo_path = null, fees_policy = null, match_subs_fee = null, monthly_fee = null,
      yearly_fee = null, other_fee = null, other_fee_label = null, facilities = '{}',
      facilities_other = null, football_section = excluded.football_section,
      active_section = excluded.active_section;
  else
    select case when football_section = 'both' then active_section else football_section end
      into _sec from public.clubs where id = _profile_id;
    _sec := coalesce(_sec, 'mens');
    delete from public.club_history where club_id = _profile_id;
    delete from public.saved_players where club_id = _profile_id;
    delete from public.saved_clubs where club_id = _profile_id;
    update public.vacancies set status = 'closed' where club_id = _profile_id and status = 'active';
    update public.clubs set short_name = null, badge_path = null, location = null, home_ground = null,
      league = null, level_id = null, founded = null, description = null, training_days = null,
      training_location = null, training_time = null, match_day = null, contact_name = null,
      contact_role = null, contact_email = null, recruitment_status = 'closed', team_photo_path = null,
      home_ground_photo_path = null, training_pitch_photo_path = null, fees_policy = null,
      match_subs_fee = null, monthly_fee = null, yearly_fee = null, other_fee = null,
      other_fee_label = null, facilities = '{}', facilities_other = null
    where id = _profile_id;
    delete from public.player_history where player_id = _profile_id;
    insert into public.players (id, football_section) values (_profile_id, _sec)
    on conflict (id) do update set location = null, current_club_name = null, level_id = null,
      primary_position = null, secondary_positions = null, preferred_level_id = null,
      availability = 'open_to_offers', preferred_training_days = null, max_travel_miles = null,
      open_to_trials = true, bio = null, looking_for = null, height_inches = null,
      football_section = excluded.football_section;
  end if;

  perform set_config('ballfindr.account_type_rpc', 'on', true);
  update public.profiles set account_type = _to, avatar_path = null, cover_path = null where id = _profile_id;
  perform set_config('ballfindr.account_type_rpc', 'off', true);

  select display_name into _admin_name from public.profiles where id = _caller;
  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, previous_status, new_status,
     subject_display_name, admin_display_name, note)
  values (_caller, 'account_type_changed', _profile_id, _old::text, _to::text, _name, _admin_name,
    format('Account type changed from %s to %s by admin; old %s profile cleared', initcap(_old::text), initcap(_to::text), _old));
  return _to::text;
end $$;

revoke all on function public.admin_switch_account_type(uuid, public.account_type) from public, anon;
grant execute on function public.admin_switch_account_type(uuid, public.account_type) to authenticated;