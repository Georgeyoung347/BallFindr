/**
 * Permanent account deletion (administrators only).
 *
 * Security model:
 * - requireSupabaseAuth identifies the caller ONLY from the verified bearer
 *   token. No user ID or role is ever accepted from the browser.
 * - requireAdminContext re-checks public.is_admin() in the database, so a
 *   player or club account calling this RPC is rejected before any work.
 * - An administrator can never delete the account they are signed in as.
 * - The service-role client is imported inside the handler (never at module
 *   scope) so it can't leak into the browser bundle, and it is only reached
 *   after the admin check passes.
 *
 * What is removed: the Supabase Auth user, the profile row and — through the
 * existing ON DELETE CASCADE relationships — the player/club record, media,
 * messages, conversations, applications, trial invites, saved lists,
 * achievements, history, notifications and profile views. Stored files in the
 * profile-images and player-media buckets are removed too.
 *
 * What is kept: reports and the moderation audit trail. Those rows keep the
 * evidence and the account's display name as plain text and simply lose the
 * link to the deleted account (ON DELETE SET NULL), so admin history is never
 * destroyed by a deletion.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

export const deleteAccountPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; confirm: string }) => {
    if (!data?.profileId) throw new Error("An account is required");
    if (data.confirm !== "DELETE") throw new Error("Type DELETE to confirm this deletion");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);

    if (data.profileId === context.userId) {
      throw new Error("You cannot delete the administrator account you are signed in as");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name, account_type, avatar_path, cover_path")
      .eq("id", data.profileId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("That account no longer exists");

    const { data: actor } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();

    // Keep the audit trail readable after the links are cleared.
    await admin
      .from("reports")
      .update({ reported_display_name: profile.display_name })
      .eq("reported_profile_id", profile.id);
    await admin
      .from("reports")
      .update({ reporter_display_name: profile.display_name })
      .eq("reporter_profile_id", profile.id);
    await admin
      .from("moderation_actions")
      .update({ subject_display_name: profile.display_name })
      .eq("subject_profile_id", profile.id);

    // Record the deletion itself before the account disappears.
    await admin.from("moderation_actions").insert({
      admin_profile_id: context.userId,
      admin_display_name: actor?.display_name ?? null,
      action: "account_deleted",
      subject_profile_id: null,
      subject_display_name: profile.display_name,
      previous_status: `${profile.account_type} account`,
      new_status: "deleted permanently",
      note: `Account ${profile.display_name} (${profile.id}) permanently deleted`,
    });

    // Stored files: profile images and any uploaded media.
    const profileFiles = [profile.avatar_path, profile.cover_path].filter(Boolean) as string[];
    if (profile.account_type === "club") {
      const { data: club } = await admin
        .from("clubs")
        .select("badge_path, team_photo_path, home_ground_photo_path, training_pitch_photo_path")
        .eq("id", profile.id)
        .maybeSingle();
      for (const path of Object.values(club ?? {})) {
        if (typeof path === "string" && path) profileFiles.push(path);
      }
    }
    if (profileFiles.length) {
      const { error } = await admin.storage.from("profile-images").remove(profileFiles);
      if (error) console.error("[admin] could not remove profile images", error);
    }

    const { data: media } = await admin
      .from("media")
      .select("bucket, storage_path")
      .eq("owner_profile_id", profile.id);
    const byBucket = new Map<string, string[]>();
    for (const row of (media ?? []) as { bucket: string; storage_path: string }[]) {
      if (!row.storage_path) continue;
      const list = byBucket.get(row.bucket) ?? [];
      list.push(row.storage_path);
      byBucket.set(row.bucket, list);
    }
    for (const [bucket, paths] of byBucket) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) console.error("[admin] could not remove media files", error);
    }

    // Profile row first (cascades every owned record), then the Auth user.
    const { error: deleteProfileError } = await admin.from("profiles").delete().eq("id", profile.id);
    if (deleteProfileError) throw new Error(deleteProfileError.message);

    const { error: authError } = await admin.auth.admin.deleteUser(profile.id);
    if (authError && !/not found/i.test(authError.message)) {
      throw new Error(`The account data was removed but the sign-in could not be deleted: ${authError.message}`);
    }

    return { ok: true as const, displayName: profile.display_name as string };
  });
