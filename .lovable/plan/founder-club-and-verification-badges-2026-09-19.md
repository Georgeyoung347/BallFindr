# Founder Club and verification badges

## Existing sources of truth
- Keep `clubs.is_founder_club` as the only Founder Club status. Keep `founder_granted_at` and `founder_granted_by` for its audit trail.
- Keep `profiles.verification_status = 'verified'` as the only verified state for both players and clubs.
- Do not add tables, status fields, workflows, permissions, or role logic.

## Database fix
- Add the missing authenticated read grant for the three existing Founder Club columns. The current admin action successfully writes `is_founder_club`, but admin reads run with the signed-in administrator session and cannot currently read that newly added column.
- Preserve all existing RLS policies, admin-only update protection, verification protections, player privacy rules, messaging rules, and other security functions.
- Confirm the current Founder Club row becomes visible through the same query used by the admin list, and that toggling the existing field controls list membership.

## Reusable account badges
- Add one reusable inline name treatment with:
  - a subtle shield-with-check Founder icon when a club has `is_founder_club = true`;
  - a small green verified check when `verification_status = 'verified'`;
  - accessible labels/tooltips without adding repeated visible text.
- Use semantic design tokens and the existing BallFindr icon style.

## Data wiring
- Extend existing club and player view models and queries to carry only the two existing status values needed by the UI.
- Include status data in the existing discovery, profiles, saved lists, applications, trial invitations, messaging counterparts, dashboards, admin lists/detail, and signed-in account shell paths.
- Keep player-private fields and current least-privilege access unchanged.

## UI coverage
- Apply the reusable badges beside names in shared player/club cards first, then remaining direct name displays:
  - club and player discovery/search;
  - public and own profiles;
  - saved clubs and saved players;
  - applications, shortlists, trial invitations, and dashboard summaries;
  - conversation lists and conversation headers;
  - admin overview, account tables, Founder Clubs list, verification list, and account detail;
  - signed-in account identity where the status is available.
- Founder icons render for Founder Clubs only. Verified checks render for verified players and verified clubs only. Removing either status removes its badge on refetch/invalidation.

## Validation
- Verify database reads and admin mutations for one Founder and one non-Founder club.
- Verify a verified player, verified club, unverified player, and unverified club render the correct badges.
- Verify grant/remove Founder and verify/remove verification update the relevant list and badge without changing permissions.
- Exercise representative discovery, profile, saved, applications, messaging, and admin screens on desktop and mobile.
- Run the project typecheck and production build, then inspect current runtime/build diagnostics.
