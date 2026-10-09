# Profile Images & Club Photos

## Goal
Add secure, optional imagery to player and club profiles using the existing Supabase records, existing profile screens, and one shared image system. Initials remain the fallback everywhere.

## What will be built

### Player images
- Use the existing `profiles.avatar_path` as the single player profile-picture reference.
- Add one optional player cover-image reference.
- Add upload, preview, replace, and remove controls to the signed-in player’s profile editor.
- Show the cover prominently at the top of both the player’s own profile and the club-facing player profile.
- Count the profile picture in the existing player Profile Strength calculation; do not count the cover separately.

### Club images
- Use the existing `clubs.badge_path` as the single club badge reference.
- Add optional references for team photo, home-ground photo, and training-pitch photo.
- Add independent upload, preview, replace, and remove controls to the signed-in club’s profile editor.
- Show the team photo as the large club profile cover, while keeping the badge as the small club identity image.
- Show home-ground and training-pitch photos as the two supporting images near the bottom of club profiles.

### Shared presentation
- Add reusable image/avatar and editable-image controls that match BallFindr’s current styling.
- Replace initials with real images whenever a stored image exists across discovery cards, profiles, applications, shortlist, saved items, vacancies/opportunities, navigation identity, and messaging.
- Preserve initials and polished cover/photo placeholders when no upload exists.
- Keep image dimensions stable and use appropriate cropping: profile photos and badges for identity, wide crops for covers, landscape crops for supporting photos.

## Storage and security
- Create one private Supabase Storage bucket for profile imagery with an 8 MB per-file limit.
- Accept JPEG, PNG, and WebP only, validated in the browser before upload and restricted by the bucket configuration.
- Store files under an authenticated owner folder and add Storage policies so:
  - authenticated users can view profile imagery;
  - users can upload, replace, or remove only files inside their own folder;
  - nobody can manage another user’s files.
- Add only the missing image-path columns to the existing profile/club tables and retain existing row-level ownership policies for changing references.
- Resolve private files to signed display URLs rather than storing temporary URLs in the database.
- On replacement: upload the new file, save its new path, then remove the old file. If saving fails, remove the new upload.
- On removal: clear the database reference first, then delete the former object so no broken reference remains.

## Technical implementation
- Extend the existing player and club profile record/form mappings with image paths and display URLs.
- Centralize path-to-signed-URL resolution and image upload/removal behavior in one image utility, avoiding separate avatar systems.
- Propagate avatar/badge URLs through the current discovery, applications, saved, vacancy, and messaging data shapes instead of adding parallel lookups in UI components.
- Update shared identity components to accept an optional image while retaining their current initials fallback and accessible alt text.
- Invalidate all affected profile, discovery, messaging, application, and saved-item queries after an image change so updates appear without a new session.
- Do not alter application, trial, messaging, saved-item, profile-view, history, achievement, vacancy, notification, or authentication behavior.

## Verification
- Confirm player profile-picture and cover upload, preview, replace, and removal, including Profile Strength.
- Confirm club badge, team, home-ground, and training-pitch image upload, preview, replace, and removal independently.
- Verify one account cannot upload into, delete from, or update references owned by another account.
- Verify authenticated viewers can see images but cannot manage them.
- Check every identity surface for image-first rendering and initials fallback.
- Check own and public player/club profiles on mobile and desktop, including empty states and image cropping.
- Run focused tests, TypeScript checks, production build, database/security checks, and a final search for initials-only identity renderers.
