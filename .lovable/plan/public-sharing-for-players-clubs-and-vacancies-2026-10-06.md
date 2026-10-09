# Public sharing for players, clubs and vacancies

## What you'll get
- A **Share** button (existing button style) on player profiles, club profiles and opportunities. On phones it opens the normal share menu (WhatsApp, Messages, Instagram, etc.). On computers it copies the link and shows "Link copied".
- Each player, club and vacancy gets its own clean, permanent public link:
  - `ballfindr.co.uk/players/jamie-smith-4k2p`
  - `ballfindr.co.uk/clubs/riverside-fc-8hq1`
  - `ballfindr.co.uk/vacancies/striker-riverside-fc-2mzt`
- Anyone can open these links **without an account** and see the real, live page.
- Buttons that need an account (Message, Save, I'm Interested, Invite to Trial) show "Sign up or log in to continue". After signing up or in, the person comes back to the same page and the action is ready to finish.
- Proper link previews in WhatsApp, Facebook, X, etc.: name, short description, and the profile photo or club badge, or a BallFindr branded image when there isn't one.
- Friendly messages for missing, hidden, deleted or closed items, e.g. "This vacancy is no longer available", still showing the club where it's public. No reasons for hiding are revealed.

## What stays the same
- All existing signed-in pages (`/player/...`, `/club/...`, `/admin/...`), dashboards, Find pages, editing, saving, trials, notifications, account switching and permissions. The new public pages sit alongside them and don't replace them.
- Tables stay private. No table becomes readable by the public.

## What the public pages show
Only what signed-in members already see on a profile. They never show email, phone, date of birth (age only, like now), internal IDs, admin data, verification internals, report or moderation information, or the hidden admin club. Hidden, restricted, deleted and wrong-side (switched) accounts show "This profile isn't available".

## Technical details
- **Database (one migration):**
  - Add a `slug` column (unique) to `players`, `clubs` and `club_vacancies`. A trigger fills it in from the name or title plus a short random code. Existing rows are filled in once. A slug never changes after it's created, so old links keep working after renames.
  - Add three read-only `security definer` functions: `get_public_player(slug)`, `get_public_club(slug)` and `get_public_vacancy(slug)`. They return a fixed set of safe fields and apply the existing `private.account_visible` and restriction rules plus the admin-club exclusion. `EXECUTE` is granted to anon and authenticated. **No RLS policy changes.**
- **Routes (new, public, server-rendered):** `players.$slug.tsx`, `clubs.$slug.tsx`, `vacancies.$slug.tsx`. The loader calls a public server function (publishable key, `rpc` only). `head()` builds the title, description, canonical, `og:url`, `og:image` and `twitter:card` from the loader data. `notFound` and error components show branded messages. The pages reuse existing display pieces (Avatar, Panel, Pill, history and achievement lists, media gallery where already public).
- **Share:** a new `ShareButton` component (`navigator.share`, falling back to clipboard + sonner toast). The URL is always the canonical `https://ballfindr.co.uk/...` link. It's added to the new public pages and to the existing signed-in player, club and opportunity views, pointing to the public link.
- **Return flow:** sign-in-required buttons link to `/auth?redirect=/vacancies/...&intent=interest`. `auth.tsx` and `welcome` setup accept only a safe same-site `redirect` path and go there after sign-in or setup instead of the dashboard. On return, the page sees `intent` and opens the matching action (for example, it confirms the I'm Interested submission). Wrong account type (for example, a club pressing "I'm Interested") gets a clear message, not a loop.
- **Fallback image:** a 1200x630 branded image made from the existing logo and green/black/white colours, uploaded as a hosted asset so it has an absolute URL.
- **Sitemap/robots:** public pages are added to the sitemap and are indexable. Signed-in and admin pages stay `noindex`.
- Record the public-read rule in AGENTS.md.

## Limitations to know
WhatsApp, Facebook, X and LinkedIn save previews for days. After a photo or name change, old shares may still show the old preview until those apps refresh it (Facebook's Sharing Debugger can force a refresh). Instagram and TikTok don't show previews for links in bios or DMs in the same way. Opening links straight into the phone app (deep linking) isn't included. Links open the website, which the app already loads.
