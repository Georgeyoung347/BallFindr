<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Admin cross-account read views use a requireSupabaseAuth server function that calls requireAdminContext before loading the service-role client inside the handler — keeps member RLS narrow instead of broadening policies for admins.
- User settings and account management live only in src/components/settings/SettingsPage.tsx (routes /player/settings, /club/settings); profile pages must not duplicate them — keeps one place per setting.
- The native app (capacitor.config.ts) is a thin Capacitor shell loading the live site via server.url; native-shell/ holds only the offline fallback — keeps the website the single source of truth.
- Public share pages (/players/$slug, /clubs/$slug, /vacancies/$slug) read only through security-definer get_public_* SQL functions returning a fixed safe field set via a publishable-key server function — tables stay non-public and slugs never change so shared links stay stable.
- Native push device tokens live only in public.push_devices, keyed to the account (profiles.id = auth user id) with owner-only RLS and no anon access; future push sending must read them server-side and reuse the existing notifications pipeline and preferences — keeps one notification system and stays correct across Player/Club switching.
