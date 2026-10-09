# Subtle profile header backgrounds

## Changes
- Place the Player Cover Image behind the existing player header content on both player-profile views.
- Place the Club Team Photo behind the existing club header content on both club-profile views.
- Keep each photo absolutely positioned with centered cover fitting, so it adds no page height.
- Add a restrained overlay for readable foreground content and keep avatars, names, details, actions, and badges above it.
- Preserve the existing no-image state without changing any image management behavior.

## Verification
- Confirm the header height is driven only by its content on desktop and mobile.
- Confirm image clipping, layering, text readability, and fallback behavior.
- Run TypeScript and production build checks.
