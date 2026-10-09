# Correct profile photo proportions

## Changes
- Change the large Player Cover Image on both owner and club-facing profiles to a responsive 3:2 landscape area.
- Change the large Club Team Photo on both owner and player-facing profiles to the same responsive 3:2 landscape area.
- Restore `object-fit: cover` with centered positioning so photos fill the area without distortion or empty space.
- Leave supporting venue photos, empty states, uploads, storage, permissions, validation, replacement, and removal unchanged.

## Verification
- Inspect desktop and mobile sizing and clipping in the rendered layouts.
- Run TypeScript and production build checks.
