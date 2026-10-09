# BallFindr Light Mode

## Goal
Add a polished, persistent Light Mode alongside the unchanged existing Dark Mode, using the current semantic styling system and without altering application behavior or layout.

## Implementation
- Extend the existing global color tokens with an intentional light palette: white and soft-grey surfaces, charcoal text, light borders, accessible status colors, and BallFindr blue for interactive accents.
- Keep the current dark token values intact under the dark theme.
- Add a small theme controller that applies the saved theme before the page paints, preventing a light/dark flash on refresh.
- Add a compact Dark/Light selector to the existing account area on both player and club profile pages; do not add navigation or a separate settings page.
- Preserve existing cards, buttons, forms, dialogs, menus, notifications, loading/empty/error states, imagery, spacing, typography, and responsive structure. Replace only the few dark-specific visual values that bypass semantic tokens.

## Technical details
- Use a root `light`/`dark` class and `localStorage`; no database, authentication, or Supabase changes.
- Continue using Tailwind v4 semantic tokens from `src/styles.css` so existing UI primitives inherit the active theme automatically.
- Make overlays and media lightboxes intentionally dark where necessary for image/video viewing, while adapting application surfaces and shadows per theme.
- Verify key public, player, and club screens at desktop and mobile sizes, including dialogs/forms and a refresh persistence check.

## Validation
- TypeScript check and production build.
- Visual checks for Light and Dark modes on landing, authentication, player, and club areas.
- Confirm persistence after reload and no new horizontal overflow.
- Confirm no functional, database, permission, routing, or navigation changes.
