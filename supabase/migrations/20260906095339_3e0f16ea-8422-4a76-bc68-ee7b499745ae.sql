-- ============ ENUMS ============
create type public.app_role as enum ('admin','moderator');
create type public.account_type as enum ('player','club');
create type public.availability as enum ('actively_looking','open_to_offers','not_looking');
create type public.position_code as enum ('GK','RB','CB','LB','CDM','CM','CAM','RW','LW','ST');
create type public.vacancy_status as enum ('active','closed','filled','expired');
create type public.application_stage as enum ('interested','reviewing','shortlisted','contacted','trial','accepted','rejected','withdrawn');
create type public.media_kind as enum ('highlight','video','photo');
create type public.achievement_kind as enum ('award','league_title','cup','individual','promotion','relegation','other');

-- ============ LEVELS (reference data) ============
create table public.levels (
  id smallint primary key,
  name text not null unique,
  rank smallint not null unique
);
grant select on public.levels to anon, authenticated;
grant all on public.levels to service_role;
alter table public.levels enable row level security;
create policy "Levels are readable by everyone" on public.levels for select using (true);

insert into public.levels (id, name, rank) values
  (1,'Sunday',0),(2,'Amateur',1),(3,'Step 8',2),(4,'Step 7',3),(5,'Step 6',4),
  (6,'Step 5',5),(7,'Step 4',6),(8,'Step 3',7),(9,'Step 2',8),(10,'Step 1',9);

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type public.account_type not null,
  display_name text not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can read their own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============ PLAYERS ============
create table public.players (
  id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date,
  location text,
  current_club_name text,
  level_id smallint references public.levels(id),
  primary_position public.position_code,
  secondary_positions public.position_code[],
  preferred_level_id smallint references public.levels(id),
  availability public.availability not null default 'open_to_offers',
  preferred_training_days text[],
  max_travel_miles int,
  open_to_trials boolean not null default true,
  bio text,
  looking_for text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Column-level SELECT: everything EXCEPT date_of_birth for general users
grant select (id, location, current_club_name, level_id, primary_position, secondary_positions, preferred_level_id, availability, preferred_training_days, max_travel_miles, open_to_trials, bio, looking_for, created_at, updated_at) on public.players to authenticated;
grant insert, update on public.players to authenticated;
grant all on public.players to service_role;
alter table public.players enable row level security;
create policy "Players are readable by authenticated users" on public.players for select to authenticated using (true);
create policy "Players can update their own record" on public.players for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============ CLUBS ============
create table public.clubs (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default 'New club',
  short_name text,
  badge_path text,
  location text,
  home_ground text,
  league text,
  level_id smallint references public.levels(id),
  founded text,
  description text,
  training_days text[],
  training_location text,
  training_time text,
  match_day text,
  contact_name text,
  contact_role text,
  contact_email text,
  recruitment_status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Column-level SELECT: everything EXCEPT contact details for general users
grant select (id, name, short_name, badge_path, location, home_ground, league, level_id, founded, description, training_days, training_location, training_time, match_day, recruitment_status, created_at, updated_at) on public.clubs to authenticated;
grant insert, update on public.clubs to authenticated;
grant all on public.clubs to service_role;
alter table public.clubs enable row level security;
create policy "Clubs are readable by authenticated users" on public.clubs for select to authenticated using (true);
create policy "Clubs can update their own record" on public.clubs for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============ HISTORY & ACHIEVEMENTS ============
create table public.player_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season text not null,
  season_start smallint not null,
  club_name text not null,
  level_id smallint references public.levels(id),
  league text,
  position public.position_code,
  appearances int,
  goals int,
  assists int,
  notes text,
  created_at timestamptz not null default now()
);
grant select on public.player_history to authenticated;
grant insert, update, delete on public.player_history to authenticated;
grant all on public.player_history to service_role;
alter table public.player_history enable row level security;
create policy "Player history is readable by authenticated users" on public.player_history for select to authenticated using (true);
create policy "Players manage their own history" on public.player_history for all to authenticated using (auth.uid() = player_id) with check (auth.uid() = player_id);
create index player_history_player_idx on public.player_history (player_id, season_start desc);

create table public.club_history (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season text not null,
  season_start smallint not null,
  league text not null,
  level_id smallint references public.levels(id),
  final_position text,
  outcome text,
  cup_achievement text,
  notes text,
  created_at timestamptz not null default now()
);
grant select on public.club_history to authenticated;
grant insert, update, delete on public.club_history to authenticated;
grant all on public.club_history to service_role;
alter table public.club_history enable row level security;
create policy "Club history is readable by authenticated users" on public.club_history for select to authenticated using (true);
create policy "Clubs manage their own history" on public.club_history for all to authenticated using (auth.uid() = club_id) with check (auth.uid() = club_id);
create index club_history_club_idx on public.club_history (club_id, season_start desc);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind public.achievement_kind not null,
  title text not null,
  season text,
  club_name text,
  detail text,
  created_at timestamptz not null default now()
);
grant select on public.achievements to authenticated;
grant insert, update, delete on public.achievements to authenticated;
grant all on public.achievements to service_role;
alter table public.achievements enable row level security;
create policy "Achievements are readable by authenticated users" on public.achievements for select to authenticated using (true);
create policy "Owners manage their own achievements" on public.achievements for all to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create index achievements_profile_idx on public.achievements (profile_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind public.media_kind not null,
  bucket text not null,
  storage_path text not null,
  title text,
  created_at timestamptz not null default now()
);
grant select on public.media to authenticated;
grant insert, update, delete on public.media to authenticated;
grant all on public.media to service_role;
alter table public.media enable row level security;
create policy "Media is readable by authenticated users" on public.media for select to authenticated using (true);
create policy "Owners manage their own media" on public.media for all to authenticated using (auth.uid() = owner_profile_id) with check (auth.uid() = owner_profile_id);

-- ============ VACANCIES ============
create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  positions public.position_code[] not null,
  title text,
  level_id smallint references public.levels(id),
  location text,
  training_days text[],
  match_day text,
  description text,
  requirements text,
  trials_available boolean not null default false,
  status public.vacancy_status not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.vacancies to authenticated;
grant insert, update, delete on public.vacancies to authenticated;
grant all on public.vacancies to service_role;
alter table public.vacancies enable row level security;
create policy "Vacancies are readable by authenticated users" on public.vacancies for select to authenticated using (true);
create policy "Clubs manage their own vacancies" on public.vacancies for all to authenticated using (auth.uid() = club_id) with check (auth.uid() = club_id);
create index vacancies_club_idx on public.vacancies (club_id, status);

-- ============ APPLICATIONS ============
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  vacancy_id uuid not null references public.vacancies(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  stage public.application_stage not null default 'interested',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, vacancy_id)
);
grant select, insert, update on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "Involved player or club can read an application" on public.applications for select to authenticated using (auth.uid() = player_id or auth.uid() = club_id);
create policy "Players can create their own applications" on public.applications for insert to authenticated with check (auth.uid() = player_id);
create policy "Involved player or club can update an application" on public.applications for update to authenticated using (auth.uid() = player_id or auth.uid() = club_id) with check (auth.uid() = player_id or auth.uid() = club_id);
create index applications_player_idx on public.applications (player_id);
create index applications_club_idx on public.applications (club_id);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage public.application_stage,
  to_stage public.application_stage not null,
  actor_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
grant select, insert on public.application_events to authenticated;
grant all on public.application_events to service_role;
alter table public.application_events enable row level security;
create policy "Involved parties can read application events" on public.application_events for select to authenticated using (
  exists (select 1 from public.applications a where a.id = application_id and (a.player_id = auth.uid() or a.club_id = auth.uid()))
);
create index application_events_app_idx on public.application_events (application_id);

-- ============ SAVED ITEMS ============
create table public.saved_clubs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, club_id)
);
grant select, insert, delete on public.saved_clubs to authenticated;
grant all on public.saved_clubs to service_role;
alter table public.saved_clubs enable row level security;
create policy "Players manage their saved clubs" on public.saved_clubs for all to authenticated using (auth.uid() = player_id) with check (auth.uid() = player_id);

create table public.saved_vacancies (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  vacancy_id uuid not null references public.vacancies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, vacancy_id)
);
grant select, insert, delete on public.saved_vacancies to authenticated;
grant all on public.saved_vacancies to service_role;
alter table public.saved_vacancies enable row level security;
create policy "Players manage their saved vacancies" on public.saved_vacancies for all to authenticated using (auth.uid() = player_id) with check (auth.uid() = player_id);

create table public.saved_players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (club_id, player_id)
);
grant select, insert, delete on public.saved_players to authenticated;
grant all on public.saved_players to service_role;
alter table public.saved_players enable row level security;
create policy "Clubs manage their saved players" on public.saved_players for all to authenticated using (auth.uid() = club_id) with check (auth.uid() = club_id);

-- ============ PROFILE VIEWS ============
create table public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewed_profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_profile_id uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz not null default now(),
  source text,
  day date not null default ((now() at time zone 'UTC')::date),
  unique (viewed_profile_id, viewer_profile_id, day)
);
grant select, insert on public.profile_views to authenticated;
grant all on public.profile_views to service_role;
alter table public.profile_views enable row level security;
create policy "Owners can read views of their profile" on public.profile_views for select to authenticated using (auth.uid() = viewed_profile_id);
create policy "Authenticated users can record views" on public.profile_views for insert to authenticated with check (viewer_profile_id is null or viewer_profile_id = auth.uid());
create index profile_views_viewed_idx on public.profile_views (viewed_profile_id, day);

-- ============ NOTIFICATIONS ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Users read their own notifications" on public.notifications for select to authenticated using (auth.uid() = recipient_profile_id);
create policy "Users can mark their own notifications read" on public.notifications for update to authenticated using (auth.uid() = recipient_profile_id) with check (auth.uid() = recipient_profile_id);
create index notifications_recipient_idx on public.notifications (recipient_profile_id, created_at desc);

-- ============ SAFE DISCOVERY VIEWS (no DOB / no contact info) ============
create view public.player_cards with (security_invoker = true) as
select
  p.id,
  pr.display_name,
  pr.avatar_path,
  p.location,
  p.current_club_name,
  p.level_id,
  p.primary_position,
  p.secondary_positions,
  p.preferred_level_id,
  p.availability,
  p.preferred_training_days,
  p.max_travel_miles,
  p.open_to_trials,
  p.bio,
  p.looking_for,
  case when p.date_of_birth is not null then date_part('year', age(p.date_of_birth))::int end as age,
  p.created_at
from public.players p
join public.profiles pr on pr.id = p.id;
grant select on public.player_cards to authenticated;

create view public.club_cards with (security_invoker = true) as
select
  c.id,
  c.name,
  c.short_name,
  c.badge_path,
  c.location,
  c.home_ground,
  c.league,
  c.level_id,
  c.founded,
  c.description,
  c.training_days,
  c.training_location,
  c.training_time,
  c.match_day,
  c.recruitment_status,
  c.created_at
from public.clubs c;
grant select on public.club_cards to authenticated;

-- Owner-only full-record views (include private columns, scoped to the caller)
create view public.player_self as select p.* from public.players p where p.id = auth.uid();
grant select on public.player_self to authenticated;

create view public.club_self as select c.* from public.clubs c where c.id = auth.uid();
grant select on public.club_self to authenticated;

-- ============ FUNCTIONS & TRIGGERS ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_players_updated_at before update on public.players for each row execute function public.set_updated_at();
create trigger set_clubs_updated_at before update on public.clubs for each row execute function public.set_updated_at();
create trigger set_vacancies_updated_at before update on public.vacancies for each row execute function public.set_updated_at();
create trigger set_applications_updated_at before update on public.applications for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
  v_name text;
begin
  v_type := coalesce(new.raw_user_meta_data->>'account_type', 'player');
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1));
  insert into public.profiles (id, account_type, display_name)
  values (new.id, v_type::public.account_type, v_name);
  if v_type = 'club' then
    insert into public.clubs (id, name) values (new.id, v_name);
  else
    insert into public.players (id) values (new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.enforce_application_club()
returns trigger language plpgsql set search_path = public as $$
declare
  v_club uuid;
begin
  select club_id into v_club from public.vacancies where id = new.vacancy_id;
  if v_club is null then
    raise exception 'Vacancy % not found', new.vacancy_id;
  end if;
  new.club_id := v_club;
  return new;
end $$;

create trigger enforce_application_club_before_write
  before insert or update of vacancy_id on public.applications
  for each row execute function public.enforce_application_club();

create or replace function public.on_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.application_events (application_id, from_stage, to_stage, actor_profile_id)
  values (new.id, null, new.stage, auth.uid());
  insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
  select new.club_id, 'new_interest',
         pr.display_name || ' is interested in your vacancy',
         coalesce(v.title, 'Vacancy'),
         'application', new.id
  from public.profiles pr, public.vacancies v
  where pr.id = new.player_id and v.id = new.vacancy_id;
  return new;
end $$;

create trigger on_application_insert
  after insert on public.applications
  for each row execute function public.on_application_insert();

create or replace function public.on_application_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.application_events (application_id, from_stage, to_stage, actor_profile_id)
    values (new.id, old.stage, new.stage, auth.uid());
    insert into public.notifications (recipient_profile_id, type, title, body, entity_type, entity_id)
    select new.player_id, 'stage_change',
           'Application update: ' || new.stage,
           c.name || ' moved your application to ' || new.stage,
           'application', new.id
    from public.clubs c where c.id = new.club_id;
  end if;
  return new;
end $$;

create trigger on_application_stage_change
  after update of stage on public.applications
  for each row execute function public.on_application_stage_change();