/**
 * Permanent account deletion for the signed-in user (player or club).
 *
 * Security model:
 * - The caller is identified ONLY from the verified bearer token
 *   (requireSupabaseAuth). No user ID is accepted from the browser.
 * - The service-role client is loaded inside the handler after the caller is
 *   verified, and is used solely for the caller's own user ID.
 *
 * Order of operations:
 * 1. Remove the caller's own Storage objects (profile-images + player-media,
 *    both keyed by `{userId}/...`). If this fails the account is left intact
 *    and an error is returned — no partial "success".
 * 2. Delete the auth user. `profiles.id -> auth.users` cascades, which removes
 *    every owned row (see the account-deletion audit for the full map).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DELETE_CONFIRMATION_WORD = "DELETE";

const OWNED_BUCKETS = ["profile-images", "player-media"] as const;

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => {
    if (typeof input?.confirmation !== "string") throw new Error("Confirmation is required");
    return { confirmation: input.confirmation };
  })
  .handler(async ({ data, context }) => {
    if (data.confirmation.trim() !== DELETE_CONFIRMATION_WORD) {
      throw new Error(`Type ${DELETE_CONFIRMATION_WORD} to confirm account deletion.`);
    }
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Storage cleanup — only objects inside this user's own folder.
    let removedFiles = 0;
    for (const bucket of OWNED_BUCKETS) {
      const paths: string[] = [];
      let offset = 0;
      for (;;) {
        const { data: files, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(userId, { limit: 1000, offset });
        if (error) {
          console.error(`[account-delete] list ${bucket}/${userId} failed`, error);
          throw new Error("We couldn't remove your uploaded files. Your account has not been deleted — please try again.");
        }
        for (const f of files ?? []) {
          if (f.name && f.id) paths.push(`${userId}/${f.name}`);
        }
        if (!files || files.length < 1000) break;
        offset += files.length;
      }
      if (paths.length === 0) continue;
      const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`[account-delete] remove from ${bucket} failed`, removeError);
        throw new Error("We couldn't remove your uploaded files. Your account has not been deleted — please try again.");
      }
      removedFiles += paths.length;
    }

    // 2. Delete the auth user; database rows cascade from profiles.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("[account-delete] auth deleteUser failed", authError);
      throw new Error("Your account could not be deleted right now. Please try again in a moment.");
    }

    // Defensive: confirm nothing owned is left behind.
    const { data: leftover } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (leftover) {
      console.error("[account-delete] profile row survived auth deletion", userId);
      throw new Error("Your sign-in was removed but some account data could not be cleared. Please contact support.");
    }

    return { ok: true as const, removedFiles };
  });
