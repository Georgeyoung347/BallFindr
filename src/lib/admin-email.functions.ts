/**
 * Admin: change a member's login email.
 * - Caller verified via bearer token, then public.is_admin() re-checked in the DB.
 * - The service-role client is only loaded inside the handler, after that check.
 * - Updates the existing auth user in place (same id), so every profile, message,
 *   notification, role and history row stays attached to the same account.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid email address.");

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Could not check existing accounts: " + error.message);
    const hit = data.users.find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export const getAdminUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ profileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.profileId);
    if (error || !u.user) throw new Error("Could not load this account's email.");
    return { email: u.user.email ?? "" };
  });

export const changeAdminUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ profileId: z.string().uuid(), email: emailSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: current, error: getErr } = await admin.auth.admin.getUserById(data.profileId);
    if (getErr || !current?.user) throw new Error("Account not found.");
    const oldEmail = (current.user.email ?? "").toLowerCase();
    if (oldEmail === data.email) throw new Error("That is already this account's email address.");

    const existing = await findUserIdByEmail(admin, data.email);
    if (existing && existing !== data.profileId) {
      throw new Error("This email address is already used by another BallFindr account.");
    }

    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(data.profileId, {
      email: data.email,
      email_confirm: true,
    });
    if (updErr) {
      const msg = /already|registered|exists/i.test(updErr.message)
        ? "This email address is already used by another BallFindr account."
        : `Email not changed — the sign-in service refused the update: ${updErr.message}`;
      throw new Error(msg);
    }
    if ((updated?.user?.email ?? "").toLowerCase() !== data.email) {
      throw new Error("Email not changed — the sign-in service did not apply the update.");
    }

    const [{ data: actor }, { data: subject }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
      admin.from("profiles").select("display_name").eq("id", data.profileId).maybeSingle(),
    ]);
    const { error: auditError } = await context.supabase.from("moderation_actions").insert({
      admin_profile_id: context.userId,
      admin_display_name: actor?.display_name ?? null,
      action: "email_changed",
      subject_profile_id: data.profileId,
      subject_display_name: subject?.display_name ?? null,
      previous_status: oldEmail || null,
      new_status: data.email,
      note: "Admin changed the account's login email",
    });
    if (auditError) console.error("[admin-email] audit insert failed", auditError);

    return { email: data.email };
  });
