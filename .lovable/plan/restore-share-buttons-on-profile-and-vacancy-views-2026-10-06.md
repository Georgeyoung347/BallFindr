# Restore Share buttons on profile and vacancy views

## Changes
- Replace the signed-in player's old copy-link action with the existing `ShareButton` and permanent player slug.
- Add the existing `ShareButton` to the signed-in club's own profile and the player-to-player profile view.
- Keep the existing Share placement in shared club views, and make Share visible for both open and closed public vacancy pages.
- Add Share beside each club-managed vacancy so every vacancy remains directly shareable from its normal management view.

## Validation
- Confirm every button resolves through the existing `/players/{slug}`, `/clubs/{slug}`, or `/vacancies/{slug}` URL helpers.
- Check mobile and desktop visibility on the public pages and available signed-in views.
- Run the code check and inspect current preview errors.

## Unchanged
- No changes to URL structure, social previews/images, authentication, database, RLS, storage permissions, or profile/vacancy behaviour.
