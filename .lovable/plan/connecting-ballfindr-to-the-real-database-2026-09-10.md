# Connecting BallFindr to the real database

Inspection findings and a staged plan. Nothing is built in this step.

## A. What is mock/demo data today

| Where | What it holds |
| --- | --- |
| `src/data/app-demo.ts` (686 lines) | Jack Smith (`p_jack`), Example FC (`c_example`) plus other clubs/players, vacancies, seed applications, level and availability label lists |
| `src/data/profile-demo.ts` + `profile-model.ts` | Adapters that turn the demo player/club into the richer profile records used by the profile pages |
| `src/data/demo.ts` | Landing-page preview cards only — stays as is |
| `src/lib/app-store.tsx` | React context storing saved clubs/vacancies, shortlist, applications and vacancies, persisted in browser storage under `ballfindr.demo.v1` |

Key points:
- Jack Smith and Example FC are hard-coded constants (`currentPlayer`, `currentClub`), not accounts. There is no sign-in.
- "I'm Interested" calls `applyToVacancy` in the store, which adds a row to one shared list; the club side reads that same list. Shortlist and trial invites call `setApplicationStage` / `inviteToTrial` on it.
- Every screen (dashboards, Find Clubs, Find Players, both profiles, Applications, Saved, Shortlist, Vacancies, player/club detail pages) reads from the demo file or the store. Messages and notifications are fully invented.
- Application stages in the app (`applied, viewed, shortlisted, trial, accepted, rejected`) differ from the database stages (`interested, reviewing, shortlisted, contacted, trial, accepted, rejected, withdrawn`) — this needs a small mapping.

## B. What the database replaces

| Screen area | Tables |
| --- | --- |
| Sign-in and identity | `profiles` (account type, name, photo) |
| Player profile | `players`, `player_history`, `achievements`, `media`, `levels` |
| Club profile | `clubs`, `club_history`, `achievements`, `vacancies`, `levels` |
| Find Clubs | `clubs` + `vacancies` (+ `levels` for the Step filter) |
| Find Players | `players` + `profiles` |
| I'm Interested / Applications | `applications`, `application_events` (stage history and notifications are created automatically by the database) |
| Saved / Shortlist | `saved_clubs`, `saved_vacancies`, `saved_players` |
| Dashboard counters | `applications`, `vacancies`, `profile_views` |
| Bell menu | `notifications` |
| Messaging | nothing yet — stays demo until we build it |

Match percentages, "distance in miles" and "posted 3 days ago" are presentation values with no column behind them; they get computed in the app from real fields (dates, level, location) or dropped.

## C. Order of connection (safest first)

1. **Accounts** — real sign-up/sign-in screens; a new account automatically creates its profile and its player or club record. Keep a clearly-labelled demo mode running on the old data until each screen is switched.
2. **Own profile (read)** — player profile and club profile pages read the signed-in user's real record; empty states already exist for blank sections.
3. **Own profile (edit)** — forms to fill in details, playing/club history, achievements.
4. **Vacancies** — club posts, edits and closes real vacancies.
5. **Find Clubs / Find Players** — search over real records.
6. **Interest and applications** — the whole Interested → Shortlisted → Trial journey against real rows; the club and player see the same record because it is the same row.
7. **Saved, shortlist, notifications, profile views.**
8. **Photos and videos** — needs file storage set up first.
9. **Messaging** — last, needs new tables.

## D. Problems to expect

- **No demo accounts exist yet.** Jack Smith and Example FC are not real accounts. Recommendation: create two genuine sign-ups (e.g. `jack@…` player and `example@…` club) through the normal sign-up screen and fill their profiles in, rather than inserting fake rows. They then behave exactly like any other account and can be logged into from either browser tab for testing.
- **Everything is behind sign-in.** The current app lets anyone click into `/player` and `/club`. Once connected, those areas require an account; the landing page and join flow stay public.
- **Two accounts, two sessions.** Today you switch sides by clicking a link. With real accounts you sign in as one or the other, so testing both sides means two browser windows.
- **Stage-name mismatch** between the app and the database — mapped once in a shared helper.
- **Fake numbers** (94% match, 28 profile views, applicant counts) will change to real values, so screens will look emptier at first until data is entered.
- **Browser-stored demo state** must be cleared when we cut over, otherwise old interests linger on screen.
- **Age is private** in the database by design, so profiles show an age band or age computed server-side, not a date of birth.

## E. Technical notes

- Data access via TanStack server functions using the signed-in user's session, with TanStack Query in the pages; the existing components keep their current props, so only the data source changes.
- Keep `src/data/app-demo.ts` in place during the transition and delete it once every screen is switched.
- Add a small mapping layer (`src/data/from-db.ts`) turning database rows into the existing `DemoPlayer` / `DemoClub` / profile record shapes, so no component markup changes.
- `applications` inserts already fire the club notification and stage-history rows via database triggers — the app does not need to write those.
