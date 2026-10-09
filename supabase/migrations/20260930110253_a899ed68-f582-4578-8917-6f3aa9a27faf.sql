-- Admin role management using the existing user_roles table.
create or replace function public.admin_list_admin_ids()
returns setof uuid
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  return query select ur.user_id from public.user_roles ur where ur.role = 'admin';
end;
$$;

create or replace function public.admin_set_admin_role(_profile_id uuid, _grant boolean)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _had boolean;
  _admin_count int;
  _subject_name text;
  _admin_name text;
begin
  if _caller is null or not public.is_admin() then
    raise exception 'Forbidden: administrator access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = _profile_id) then
    raise exception 'Account not found';
  end if;

  -- Serialise role changes so two admins can't both remove each other.
  lock table public.user_roles in share row exclusive mode;

  select exists (select 1 from public.user_roles where user_id = _profile_id and role = 'admin') into _had;

  if _grant then
    if _had then return true; end if;
    insert into public.user_roles (user_id, role) values (_profile_id, 'admin');
  else
    if not _had then return false; end if;
    select count(*) into _admin_count from public.user_roles where role = 'admin';
    if _admin_count <= 1 then
      raise exception 'You cannot remove the last remaining administrator';
    end if;
    delete from public.user_roles where user_id = _profile_id and role = 'admin';
  end if;

  select display_name into _subject_name from public.profiles where id = _profile_id;
  select display_name into _admin_name from public.profiles where id = _caller;

  insert into public.moderation_actions
    (admin_profile_id, action, subject_profile_id, previous_status, new_status,
     subject_display_name, admin_display_name, note)
  values
    (_caller, case when _grant then 'admin_granted' else 'admin_removed' end, _profile_id,
     case when _had then 'admin' else 'no_admin' end,
     case when _grant then 'admin' else 'no_admin' end,
     _subject_name, _admin_name,
     case when _grant then 'Admin role granted' else 'Admin role removed' end);

  return _grant;
end;
$$;

revoke all on function public.admin_list_admin_ids() from public, anon;
revoke all on function public.admin_set_admin_role(uuid, boolean) from public, anon;
grant execute on function public.admin_list_admin_ids() to authenticated;
grant execute on function public.admin_set_admin_role(uuid, boolean) to authenticated;