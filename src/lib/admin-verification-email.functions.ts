/**
 * BallFindr email re-verification for existing accounts (separate from Supabase email_confirmed_at).
 * - resendAdminVerificationEmail: admin-only; sends a BallFindr-branded email (Lovable managed email,
 *   notify.ballfindr.co.uk) whose button opens /verify-email?t=<one-time token>. Only the token's
 *   SHA-256 hash is stored; a new send replaces (invalidates) the previous token. Status -> "sent".
 * - completeEmailReverification: public (no sign-in needed); the token itself is the proof. Valid only
 *   when its hash matches a "sent" row and it is under 24h old; then status -> "reverified" and the hash
 *   is cleared so the link cannot be reused.
 * No Supabase auth emails (sign-in/magic link/confirmation) are used. Table is service-role only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

const SITE_URL = "https://ballfindr.co.uk";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const resendAdminVerificationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ profileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await (supabaseAdmin as any)
      .from("email_reverifications").select("status").eq("profile_id", data.profileId).maybeSingle();
    if (existing?.status === "reverified") throw new Error("This account has already been re-verified.");
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.profileId);
    if (error || !u?.user) throw new Error("Account not found.");
    const email = u.user.email;
    if (!email) throw new Error("This account has no email address.");

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = await sha256(token);
    const verifyUrl = `${SITE_URL}/verify-email?t=${token}`;

    // Save the new hash first so the old link stops working before the new email goes out.
    const { error: saveErr } = await (supabaseAdmin as any).from("email_reverifications").upsert({
      profile_id: data.profileId,
      status: "sent",
      token_hash: tokenHash,
      sent_at: new Date().toISOString(),
      sent_by: context.userId,
    });
    if (saveErr) throw new Error(`Could not prepare verification: ${saveErr.message}`);

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const result = await sendTemplateEmail("verify-ballfindr-email", email, {
        templateData: { verifyUrl },
        idempotencyKey: `verify-ballfindr-email-${tokenHash}`,
      });
      if (!result.sent) throw new Error("This address has unsubscribed or bounced, so the email was not sent.");
    } catch (err) {
      throw new Error(`Verification email not sent: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { ok: true };
  });

export const completeEmailReverification = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await sha256(data.token);
    const { data: row } = await (supabaseAdmin as any)
      .from("email_reverifications").select("profile_id, status, sent_at").eq("token_hash", hash).maybeSingle();
    if (!row || row.status !== "sent") {
      throw new Error("This verification link is invalid, has already been used, or has been replaced by a newer one.");
    }
    if (!row.sent_at || Date.now() - new Date(row.sent_at).getTime() > TOKEN_TTL_MS) {
      throw new Error("This verification link has expired. Please ask BallFindr to send a new one.");
    }
    const { data: updated, error } = await (supabaseAdmin as any).from("email_reverifications")
      .update({ status: "reverified", verified_at: new Date().toISOString(), token_hash: null })
      .eq("profile_id", row.profile_id).eq("token_hash", hash).eq("status", "sent")
      .select("profile_id");
    if (error || !updated?.length) throw new Error("Could not complete verification. Please try the link again.");
    return { ok: true };
  });
