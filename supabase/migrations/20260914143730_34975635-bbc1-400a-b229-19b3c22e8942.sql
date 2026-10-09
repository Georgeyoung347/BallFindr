create or replace function public.prevent_account_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type is distinct from old.account_type then
    -- Only trusted server-side roles (service_role / postgres) may change account type.
    if current_setting('role', true) in ('authenticated', 'anon')
       or auth.uid() is not null then
      raise exception 'Account type cannot be changed';
    end if;
  end if;
  new.id := old.id;
  return new;
end $$;

revoke execute on function public.prevent_account_type_change() from public, anon, authenticated;

drop trigger if exists prevent_account_type_change on public.profiles;
create trigger prevent_account_type_change
  before update on public.profiles
  for each row execute function public.prevent_account_type_change();