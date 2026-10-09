/**
 * Admin authorisation.
 *
 * Security model:
 * - The caller is identified ONLY from the verified bearer token
 *   (requireSupabaseAuth). No user ID or role is ever accepted from the browser.
 * - Admin status is decided by the database: public.is_admin() reads the
 *   dedicated public.user_roles table, which has no INSERT/UPDATE/DELETE policy,
 *   so no signed-in user can grant themselves a role.
 * - Every future admin-only server function must call requireAdminContext()
 *   (or repeat the same rpc check) before doing any work. Hiding routes in the
 *   frontend is convenience only, never the enforcement point.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = {
  supabase: { rpc: (fn: any) => PromiseLike<{ data: unknown; error: unknown }> };
};

export type StaffRole = "admin" | "moderator";

/**
 * Throws unless the verified caller is an administrator OR a moderator
 * (public.can_moderate()). Use only for moderation work; the database
 * policies/functions enforce the finer moderator limits as well.
 */
export async function requireModeratorContext(context: AuthedContext): Promise<StaffRole> {
  const { data, error } = await context.supabase.rpc("my_staff_role");
  if (error || (data !== "admin" && data !== "moderator")) {
    throw new Error("Forbidden: administrator or moderator access required");
  }
  return data as StaffRole;
}

/** Throws unless the verified caller holds the admin role in user_roles. */
export async function requireAdminContext(context: AuthedContext): Promise<void> {
  const { data, error } = await context.supabase.rpc("is_admin");
  if (error || data !== true) {
    throw new Error("Forbidden: administrator access required");
  }
}

/** Returns whether the verified caller is an administrator. Never throws on "no". */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("my_staff_role");
    if (error) {
      console.error("[admin] staff role check failed", error);
      return { isAdmin: false, isModerator: false, role: null as StaffRole | null };
    }
    const role = data === "admin" || data === "moderator" ? (data as StaffRole) : null;
    return { isAdmin: role === "admin", isModerator: role === "moderator", role, userId: context.userId };
  });
