/**
 * Validation for storage object paths read back from the database.
 *
 * Every object the app uploads lives at `<owner uuid>/<file name>` (see
 * profile-images.ts and player-media.ts). Paths stored in profile, club and
 * media rows must be checked before any storage call that would trust them,
 * in particular service-role calls, which bypass storage RLS.
 */

const SAFE_OBJECT_PATH =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/**
 * True when `path` is `<uuid>/<safe file name>` with no `..`, scheme or extra
 * folders. When `ownerId` is given, the folder must also be that owner's id.
 */
export function isSafeStoragePath(path: unknown, ownerId?: string | null): path is string {
  if (typeof path !== "string" || path.includes("..")) return false;
  const match = SAFE_OBJECT_PATH.exec(path);
  if (!match) return false;
  return ownerId == null || match[1] === ownerId.toLowerCase();
}
