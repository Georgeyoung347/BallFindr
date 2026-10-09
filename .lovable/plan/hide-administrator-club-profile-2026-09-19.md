# Hide administrator Club profile

## Existing mechanism and safest approach

- The account is an existing `club` profile named **Admin** whose profile ID is also the Club ID, and its administrator permission lives separately in `user_roles` as `admin`.
- Club discovery currently reads `clubs`, `vacancies`, and `profiles` directly under broad authenticated read policies. Saved clubs and saved vacancies join those same tables. Applications, trials, and conversations use participant-only policies, but can still surface the linked Club to an ordinary player.
- The safest source of truth is therefore the existing role relationship: a Club is hidden from ordinary users when its shared profile/Club ID has the existing `admin` role. No email, Club ID, CSS rule, new status column, or duplicate table is needed.

## Database access changes

- Replace the broad authenticated Club read rule so an administrator-owned Club is readable only by:
  - that Club account itself; or
  - an authenticated administrator.
- Apply the equivalent restriction to the matching Club profile and its vacancies, so direct detail URLs and opportunity queries cannot return it to ordinary users.
- Tighten the read paths for saved clubs, saved vacancies, applications, trial invitations, and conversations so ordinary users do not receive rows linked to an administrator-owned Club. Existing rows remain stored and are not deleted.
- Review the participant-based messaging helpers/policies and apply the same Club-visibility condition only where required to prevent hidden Club conversations from surfacing. Normal Club/player conversations remain unchanged.
- Keep all existing write permissions, administrator checks, Founder Club fields, verification fields, account type, and authentication unchanged unless a read policy must be split to preserve its current writes exactly.

## Application query safeguards

- Update shared Club discovery/detail and saved/listing query code to use the same visibility contract where needed for predictable empty states and nested joins.
- Do not alter the Admin dashboard queries; administrators remain explicitly allowed by the database rules and continue seeing/managing the account.

## Verification

- Confirm the account, Club profile, and admin role still exist and login/admin access remain intact.
- Test database reads as an ordinary player, an ordinary Club, the administrator, and logged out where relevant.
- Confirm ordinary accounts cannot receive the administrator Club through Club/profile/vacancy, saved, application, trial, or conversation listing paths.
- Confirm ordinary Clubs remain visible and normal messaging/applications still work.
- Confirm Founder Club and verification values/workflows are unchanged.
- Run focused tests, typecheck, production build, and inspect the current preview health.
