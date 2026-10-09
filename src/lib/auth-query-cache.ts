/**
 * Clears the TanStack Query cache whenever the signed-in account changes, so
 * one account's cached data (query keys are not user-scoped) is never shown
 * to the next account on the same browser or phone.
 *
 * Only a real change of user clears: SIGNED_OUT, or a sign-in as a different
 * user (including signed-out -> signed-in). INITIAL_SESSION only records the
 * restored user, and TOKEN_REFRESHED / USER_UPDATED / a repeated SIGNED_IN for
 * the same user (e.g. on tab focus) leave the cache alone. Browser only.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** undefined = not known yet; null = signed out. */
export type KnownUser = string | null | undefined;

/** Pure decision used by the listener (exported for tests). */
export function shouldClearForAuthEvent(
  event: string,
  lastUserId: KnownUser,
  nextUserId: string | null,
): boolean {
  if (event === "INITIAL_SESSION") return false;
  if (lastUserId === undefined) return event === "SIGNED_OUT";
  return nextUserId !== lastUserId;
}

let target: QueryClient | null = null;
let subscribed = false;
let lastUserId: KnownUser = undefined;

export function clearQueryCacheOnUserChange(queryClient: QueryClient): void {
  if (typeof window === "undefined") return; // SSR: one router per request, no auth state
  target = queryClient; // a re-created client (e.g. HMR) takes over the single subscription
  if (subscribed) return;
  subscribed = true;
  supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user?.id ?? null;
    if (shouldClearForAuthEvent(event, lastUserId, nextUserId)) target?.clear();
    lastUserId = nextUserId;
  });
}
