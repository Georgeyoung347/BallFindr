# Fix the mobile Club profile header

## Scope
- Keep the existing desktop Club profile and all Player profile layouts unchanged.
- Correct only the mobile Club profile identity row.
- Preserve Founder Club and verified badges.

## Implementation
- Use a mobile two-column grid for the Club badge and identity content, switching back to the existing flex layout at the desktop breakpoint.
- Give the Club-name container an explicit shrink boundary and full available width so long names truncate cleanly without covering nearby content.
- Keep badges in their own non-shrinking area beside the name while allowing only the name text to truncate.
- Keep Saved Players navigation/data untouched unless inspection identifies a real incorrect binding; the current Club profile does not read or render saved-player data, indicating the observed overwrite is a layout collision rather than a data substitution.

## Verification
- Test mobile rendering with normal and long Club names and all Founder/verified badge combinations using a focused rendering harness.
- Confirm saved-player labels/data remain separate, no horizontal overflow appears, and Player profile source remains unchanged.
- Confirm desktop classes retain the current layout, then run typecheck and production build checks.
