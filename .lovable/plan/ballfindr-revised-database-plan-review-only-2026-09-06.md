# BallFindr — Revised Database Plan (review only)

## Answers to your 12 questions

**1. Roles — recommend (C) both, but with a clear split.**
`profiles.role` is the account type (player | club) — it never changes, drives which app shell you see, and keeps RLS cheap (one lookup, no join). `user_roles` stores *permission* roles (admin, moderator) only. Storing admin on `profiles` is the classic privilege-escalation hole: a user who can edit their own profile row could grant themselves admin. So: account type on `profiles`, elevated roles in `user_roles` + a `has_role()` security-definer function. No duplication because they hold different things.

**2. Age — store `date_of_birth`, never `age`.** Age goes stale silently; DOB is computed once and lets you filter age bands, U21 eligibility, etc. Expose age via a view/derived value in the UI. Keep DOB private (only the owner and clubs the player applied to should read it; simplest MVP: readable by any authenticated user, or hide behind a view exposing only age).

**3. Saved items — recommend separate tables** (`saved_clubs`, `saved_vacancies`, `saved_players`). The polymorphic `item_type`/`item_id` pattern cannot use foreign keys, so deleted clubs leave dangling saves, and every read needs a manual join with a filter. Three tiny tables give real FKs with cascade delete, one-line RLS (`user_id = auth.uid()`), trivial joins, and simpler code. The cost is one extra table each — worth it.

**4. Profile views — add the table now, keep the UI later.** It is append-only and cheap; retrofitting it later means losing all history. Structure: `profile_views(id, viewed_profile_id, viewer_profile_id, viewed_at, source)`, insert-only for authenticated users, readable only by the profile owner, plus a unique-per-day guard so refreshes don't inflate counts.

**5. Structured data.** Use Postgres enums for the closed, stable sets: `app_role`, `account_type`, `availability`, `application_stage`, `vacancy_status`, `position_code` (GK…ST). Use a small reference table for `levels` (Sunday → Step 1) because it needs an ordering column for "Step 6 or above" filters. Keep `league` and `training_days` as plain text / text[] with a GIN index — leagues are long-tail and not worth a table at MVP. Positions on players stay as an array of the enum, which indexes fine.

**6. History tables — keep both, two changes.** Add an explicit `sort_order`/season start year (integer) so seasons order correctly without parsing "2025/26" strings, and make stats (appearances, goals, assists) nullable so unknown ≠ zero. Everything else (league, level, notes, outcome) can evolve later without migration pain.

**7. Vacancies — include now:** `status` enum (active | closed | filled | expired), `expires_at`, `created_at`/`updated_at` with trigger, `positions` (array of position enum — clubs genuinely advertise "ST or LW"), `requirements` text, `trials_available` boolean, `training_days`, `match_day`, `level_id`, `location`. Skip for later: pay/expenses, applicant caps, boosting.

**8. Applications — the model is right; widen the stage enum.** Keep the single `applications` row as the Player → Vacancy → Club link (denormalise `club_id` onto it so club RLS needs no join). Stages: `interested, reviewing, shortlisted, contacted, trial, accepted, rejected, withdrawn`. Add `application_events(id, application_id, from_stage, to_stage, actor_profile_id, created_at)` so the history is auditable and notifications can be driven off it. Unique constraint on (player_id, vacancy_id).

**9. Notifications — build the table now, triggers minimal.** Table: `notifications(id, recipient_profile_id, type, title, body, entity_type, entity_id, read_at, created_at)`. Trigger-generate only the two that come from database events: new interest and stage change (shortlisted / trial). Profile-viewed and "new relevant vacancy" should be later, batched jobs — per-view notifications are noisy and expensive.

**10. Messaging (later).** Nothing in this plan blocks it: `conversations(id, club_id, player_id, application_id nullable)` + `messages(id, conversation_id, sender_profile_id, body, created_at)` drops in cleanly because both sides already have a stable `profiles.id`.

**11. Storage (later).** Media rows store a `storage_path` plus `bucket`, not a full URL, so switching between public and signed URLs later needs no data change. `media(id, owner_profile_id, kind, bucket, storage_path, title, created_at)`. Two buckets when the time comes: public `avatars`/`badges`, private `player-media`.

**12. Overall.** Removed: polymorphic `saved_items`, `age`. Added: `date_of_birth`, `levels`, `profile_views`, `application_events`, vacancy lifecycle fields. Nothing else was over-engineered; messaging and analytics stay deferred.

---

## Final revised plan

Legend: PK = primary key, FK = foreign key, R = required.

**Enums:** `app_role(admin,moderator)`, `account_type(player,club)`, `availability(actively_looking,open_to_offers,not_looking)`, `position_code(GK,RB,CB,LB,CDM,CM,CAM,RW,LW,ST)`, `vacancy_status(active,closed,filled,expired)`, `application_stage(interested,reviewing,shortlisted,contacted,trial,accepted,rejected,withdrawn)`, `media_kind(highlight,video,photo)`, `achievement_kind(award,league_title,cup,individual,promotion,relegation,other)`.

| Table | Columns |
|---|---|
| `profiles` | id uuid PK→auth.users R, account_type R, display_name text R, avatar_path text, created_at R, updated_at R |
| `user_roles` | id uuid PK, user_id uuid FK→auth.users R, role app_role R, unique(user_id, role) — future/admin |
| `levels` | id smallint PK, name text R (Sunday…Step 1), rank smallint R |
| `players` | id uuid PK FK→profiles R, date_of_birth date, location text, current_club_name text, level_id FK→levels, primary_position position_code, secondary_positions position_code[], preferred_level_id FK→levels, availability R, preferred_training_days text[], max_travel_miles int, open_to_trials bool R, bio text, looking_for text, created_at/updated_at R |
| `clubs` | id uuid PK FK→profiles R, name text R, short_name text, badge_path text, location text, home_ground text, league text, level_id FK→levels, founded text, description text, training_days text[], training_location text, training_time text, match_day text, contact_name/role/email text, recruitment_status text R, created_at/updated_at R |
| `player_history` | id uuid PK, player_id FK→players R (cascade), season text R, season_start smallint R, club_name text R, level_id FK→levels, league text, position position_code, appearances/goals/assists int, notes text, created_at R |
| `club_history` | id uuid PK, club_id FK→clubs R (cascade), season text R, season_start smallint R, league text R, level_id FK→levels, final_position text, outcome text, cup_achievement text, notes text, created_at R |
| `achievements` | id uuid PK, profile_id FK→profiles R (cascade), kind achievement_kind R, title text R, season text, club_name text, detail text, created_at R |
| `media` | id uuid PK, owner_profile_id FK→profiles R (cascade), kind media_kind R, bucket text R, storage_path text R, title text, created_at R |
| `vacancies` | id uuid PK, club_id FK→clubs R (cascade), positions position_code[] R, title text, level_id FK→levels, location text, training_days text[], match_day text, description text, requirements text, trials_available bool R, status vacancy_status R, expires_at timestamptz, created_at/updated_at R |
| `applications` | id uuid PK, player_id FK→players R, vacancy_id FK→vacancies R, club_id FK→clubs R, stage application_stage R, note text, created_at/updated_at R, unique(player_id, vacancy_id) |
| `application_events` | id uuid PK, application_id FK→applications R (cascade), from_stage, to_stage R, actor_profile_id FK→profiles, created_at R |
| `saved_clubs` | id uuid PK, player_id FK→players R, club_id FK→clubs R, created_at R, unique(player_id, club_id) |
| `saved_vacancies` | id uuid PK, player_id FK→players R, vacancy_id FK→vacancies R, created_at R, unique pair |
| `saved_players` | id uuid PK, club_id FK→clubs R, player_id FK→players R, created_at R, unique pair |
| `profile_views` | id uuid PK, viewed_profile_id FK→profiles R, viewer_profile_id FK→profiles, viewed_at R, source text, day date R DEFAULT ((now() AT TIME ZONE 'UTC')::date), unique(viewed_profile_id, viewer_profile_id, day) — one view per viewer per profile per UTC day; inserts use ON CONFLICT DO NOTHING |
| `notifications` | id uuid PK, recipient_profile_id FK→profiles R, type text R, title text R, body text, entity_type text, entity_id uuid, read_at, created_at R |

### Views
- `player_cards` — public discovery view over `players` (+ profile display name/avatar): every field EXCEPT `date_of_birth`, plus computed `age` (`date_part('year', age(date_of_birth))`). Created `WITH (security_invoker = true)` so it respects the caller's RLS. Find Players / search read only from this view.
- `club_cards` — same idea over `clubs`: everything EXCEPT `contact_name`/`contact_role`/`contact_email`. Discovery reads this view only.

### Privacy (column-level)
- `REVOKE SELECT (date_of_birth) ON public.players FROM anon, authenticated` — general users physically cannot select DOB; they read `player_cards` and see age only.
- The owner still selects their own full row: an owner-scoped policy on `players` (`auth.uid() = id`) plus a per-user grant path (owner reads base table, or an `my_player` view). DOB is never in any broadly-readable view.
- `REVOKE SELECT (contact_name, contact_role, contact_email) ON public.clubs FROM anon, authenticated` — club contact details visible only to the owning club account; discovery uses `club_cards`.
- Same rule for any future player contact fields: never un-revoked on a broadly-readable table.

### Database functions & triggers
- `handle_new_user()` — AFTER INSERT on auth.users: creates `profiles` row (id, account_type + display_name from signup metadata), then the matching `players` or `clubs` row. SECURITY DEFINER, `SET search_path = public`.
- `set_updated_at()` — BEFORE UPDATE trigger on `profiles`, `players`, `clubs`, `vacancies`, `applications`: sets `updated_at = now()`.
- `enforce_application_club()` — BEFORE INSERT/UPDATE on `applications`: sets/validates `club_id` from the vacancy (`SELECT club_id FROM vacancies WHERE id = NEW.vacancy_id`); raises if the vacancy doesn't exist, overwrites mismatches so `applications.club_id` can never disagree with its vacancy.
- Stage-change and new-interest notification triggers as already planned (insert into `notifications` and `application_events`).

### RLS approach
- Every table RLS-enabled, with explicit GRANTs to `authenticated` (and `anon` only where noted).
- `profiles`, `players`, `clubs`, `player_history`, `club_history`, `achievements`, `vacancies`, `levels`: readable by any authenticated user (discovery product) — subject to the column revokes above; writable only by the owner (`auth.uid() = profile id` / owning club).
- `applications`: read/update limited to the owning player or the owning club; only the player inserts; club may advance the stage. `application_events` follows the parent.
- `saved_*`, `notifications`, `profile_views`: owner-only reads; `profile_views` insert allowed for any authenticated viewer.
- `media`: public rows readable by authenticated users; private bucket access through signed URLs.
- Admin access, when needed, only via `has_role(auth.uid(),'admin')`.

### Relationship diagram

```text
auth.users ──1:1── profiles ──┬──1:1── players ──┬── player_history
                              │                  ├── saved_clubs ──> clubs
                              │                  ├── saved_vacancies ──> vacancies
                              │                  └── applications ──> vacancies ──> clubs
                              ├──1:1── clubs ────┬── club_history
                              │                  ├── vacancies
                              │                  └── saved_players ──> players
                              ├── achievements
                              ├── media
                              ├── notifications
                              └── profile_views (viewer / viewed)

applications ──< application_events
levels <── players, clubs, vacancies, *_history
user_roles ──> auth.users   (admin only, future)
```

### MVP vs future
- **MVP now:** profiles, players, clubs, levels, player_history, club_history, achievements, vacancies, applications, application_events, saved_clubs/vacancies/players, notifications, profile_views, media (rows only).
- **Later:** user_roles/admin tooling, conversations + messages, storage buckets and uploads, match scoring, digest jobs for "new relevant vacancy".

### Demo account mapping
- Jack Smith → one auth user → `profiles`(account_type player) → `players` row (DOB instead of age 24, ST primary, LW secondary, Step 7, North London) → his three season rows in `player_history`.
- Example FC → one auth user → `profiles`(account_type club) → `clubs` row (Step 7, Essex Senior League, The Meadow, Tue/Thu) → its vacancies → Jack's interest becomes one `applications` row plus `application_events` for each stage change.

Nothing has been created or changed. Approve and I'll build it as a single migration.
