# Fix Player Profile mobile summary

## Change
- Use the Club Profile header summary as the direct reference: avatar beside one `min-w-0 flex-1` content column, with metadata and all status pills inside that column.
- Move the Player Profile availability/current-club/trial items into the same internal wrapping row so they cannot compete with the text column for width.
- Keep every player label/value, visual style, desktop hierarchy, and all Club Profile code unchanged.

## Verification
- Compare Player and Club profile summaries at iPhone, narrow-mobile, and desktop widths.
- Confirm natural wrapping, no clipped text, no horizontal overflow, and no word-by-word stacking.
- Run the TypeScript check and production build.
