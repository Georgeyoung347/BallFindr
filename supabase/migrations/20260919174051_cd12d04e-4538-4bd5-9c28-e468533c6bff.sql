-- 1. Verification on profiles -------------------------------------------------
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');

alter table public.profiles
  add column verification_status public.verification_status not null default 'unverified',
  add column verification_requested_at timestamptz,
  add column verification_decided_at timestamptz,
  add column verification_decided_by uuid references public.profiles(id) on delete set null,
  add column verification_notes text;

-- 2. Founder clubs -------------------------------------------------------------
alter table public.clubs
  add column is_founder_club boolean not null default false,
  add column founder_granted_at timestamptz,
  add column founder_granted_by uuid references public.profiles(id) on delete set null;

-- 3. Reports -------------------------------------------------------------------
create type public.report_status as enum ('open', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid references public.profiles(id) on delete set null,
  reported_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;

alter table public.reports enable row level security;

create policy "Users can report another account"
  on public.reports for insert to authenticated
  with check (reporter_profile_id = auth.uid() and reported_profile_id <> auth.uid());

create policy "Users can see the reports they submitted"
  on public.reports for select to authenticated
  using (reporter_profile_id = auth.uid());

create policy "Admins can see every report"
  on public.reports for select to authenticated
  using (public.is_admin());

create policy "Admins can update reports"
  on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_reported_profile_idx on public.reports (reported_profile_id);

-- 4. Admin-only write access to the new fields ---------------------------------
create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can update any club"
  on public.clubs for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Defence in depth: even with an UPDATE path on their own row, a non-admin can
-- never move these columns. Mirrors prevent_account_type_change().
create or replace function public.protect_verification_columns()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.verification_requested_at is distinct from old.verification_requested_at
      or new.verification_decided_at is distinct from old.verification_decided_at
      or new.verification_decided_by is distinct from old.verification_decided_by
      or new.verification_notes is distinct from old.verification_notes)
     and not public.is_admin() then
    raise exception 'Verification status can only be changed by an administrator';
  end if;
  return new;
end $$;

create trigger protect_verification_columns
  before update on public.profiles
  for each row execute function public.protect_verification_columns();

create or replace function public.protect_founder_columns()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (new.is_founder_club is distinct from old.is_founder_club
      or new.founder_granted_at is distinct from old.founder_granted_at
      or new.founder_granted_by is distinct from old.founder_granted_by)
     and not public.is_admin() then
    raise exception 'Founder Club status can only be changed by an administrator';
  end if;
  return new;
end $$;

create trigger protect_founder_columns
  before update on public.clubs
  for each row execute function public.protect_founder_columns();