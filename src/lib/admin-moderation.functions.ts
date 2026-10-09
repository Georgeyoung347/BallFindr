/**
 * Admin-only account restrictions (temporary / permanent bans) and the audit log.
 *
 * Security model (unchanged from the rest of the admin area):
 * - The caller is identified only from the verified bearer token.
 * - requireAdminContext() re-checks public.is_admin() in the database on every call.
 * - All writes go through context.supabase, so the RLS policies on
 *   account_restrictions and moderation_actions (admin-only insert/update) apply
 *   on top. Nothing here trusts the browser.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModeratorContext } from "./admin.functions";

export type RestrictionKind = "temporary" | "permanent";

/**
 * Restriction expiry as sent by the admin UI: a full ISO-8601 instant with an
 * offset (the browser converts the admin's local datetime-local value with
 * toISOString()). Offset-less "YYYY-MM-DDTHH:mm" values from older clients are
 * still accepted and, as before, read as UTC by the Worker.
 */
const expiresAtSchema = z.string().max(64).datetime({ offset: true, local: true });

export interface AdminRestriction {
  id: string;
  profileId: string;
  kind: RestrictionKind;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string | null;
  liftedAt: string | null;
  liftedBy: string | null;
  liftedReason: string | null;
  /** Active = not lifted and not past its expiry. */
  active: boolean;
}

export interface AdminModerationAction {
  id: string;
  action: string;
  note: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
  adminProfileId: string;
  subjectProfileId: string | null;
}

function mapRestriction(row: any): AdminRestriction {
  const expired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false;
  return {
    id: row.id,
    profileId: row.profile_id,
    kind: row.kind === "permanent" ? "permanent" : "temporary",
    reason: row.reason ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    liftedAt: row.lifted_at ?? null,
    liftedBy: row.lifted_by ?? null,
    liftedReason: row.lifted_reason ?? null,
    active: !row.lifted_at && !expired,
  };
}

/** Every restriction that is currently in force, keyed by account. */
export const listActiveRestrictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRestriction[]> => {
    await requireModeratorContext(context);
    const { data, error } = await (context.supabase as any)
      .from("account_restrictions")
      .select("*")
      .is("lifted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRestriction).filter((r: AdminRestriction) => r.active);
  });

/** Full restriction history plus audit trail for one account. */
export const getAccountModeration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string }) => {
    if (!data?.profileId) throw new Error("A profile is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const supabase = context.supabase as any;
    const [{ data: restrictions }, { data: actions }] = await Promise.all([
      supabase
        .from("account_restrictions")
        .select("*")
        .eq("profile_id", data.profileId)
        .order("created_at", { ascending: false }),
      supabase
        .from("moderation_actions")
        .select("id, action, note, previous_status, new_status, created_at, admin_profile_id, subject_profile_id")
        .eq("subject_profile_id", data.profileId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const mapped = ((restrictions ?? []) as any[]).map(mapRestriction);
    return {
      restrictions: mapped,
      active: mapped.find((r) => r.active) ?? null,
      actions: ((actions ?? []) as any[]).map(
        (row): AdminModerationAction => ({
          id: row.id,
          action: row.action,
          note: row.note ?? null,
          previousStatus: row.previous_status ?? null,
          newStatus: row.new_status ?? null,
          createdAt: row.created_at,
          adminProfileId: row.admin_profile_id,
          subjectProfileId: row.subject_profile_id ?? null,
        }),
      ),
    };
  });

/** Admin-only: restrict an account temporarily (with an expiry) or permanently. */
export const restrictAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { profileId: string; kind: RestrictionKind; expiresAt?: string; reason?: string }) => {
      if (!data?.profileId) throw new Error("An account is required");
      if (data.kind !== "temporary" && data.kind !== "permanent") {
        throw new Error("Unknown restriction type");
      }
      if (data.kind === "temporary") {
        if (!data.expiresAt) throw new Error("A temporary restriction needs an expiry date and time");
        if (!expiresAtSchema.safeParse(data.expiresAt).success) {
          throw new Error("That expiry date isn't valid");
        }
        const when = new Date(data.expiresAt).getTime();
        if (Number.isNaN(when)) throw new Error("That expiry date isn't valid");
        if (when <= Date.now()) throw new Error("The expiry must be in the future");
        // Normalise to a UTC instant so storage and the audit note agree.
        return { ...data, expiresAt: new Date(when).toISOString() };
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const role = await requireModeratorContext(context);
    const supabase = context.supabase as any;
    if (role === "moderator" && data.kind === "permanent") {
      throw new Error("Moderators can only apply temporary restrictions");
    }
    if (data.profileId === context.userId) {
      throw new Error("You cannot restrict your own administrator account");
    }

    // Lift any restriction already in force so the "one active" rule holds.
    const { data: existing } = await supabase
      .from("account_restrictions")
      .select("id, kind")
      .eq("profile_id", data.profileId)
      .is("lifted_at", null)
      .maybeSingle();
    if (existing) {
      const { error: liftError } = await supabase
        .from("account_restrictions")
        .update({
          lifted_at: new Date().toISOString(),
          lifted_by: context.userId,
          lifted_reason: "Replaced by a new restriction",
        })
        .eq("id", existing.id);
      if (liftError) throw new Error(liftError.message);
    }

    const { data: created, error } = await supabase
      .from("account_restrictions")
      .insert({
        profile_id: data.profileId,
        kind: data.kind,
        reason: data.reason?.trim() ? data.reason.trim() : null,
        expires_at: data.kind === "temporary" ? new Date(data.expiresAt!).toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: auditError } = await supabase.from("moderation_actions").insert({
      admin_profile_id: context.userId,
      action: data.kind === "permanent" ? "restriction_permanent" : "restriction_temporary",
      subject_profile_id: data.profileId,
      restriction_id: created.id,
      note: data.reason?.trim() ? data.reason.trim() : null,
      previous_status: existing ? `restricted (${existing.kind})` : "unrestricted",
      new_status:
        data.kind === "permanent"
          ? "restricted (permanent)"
          : `restricted (temporary until ${new Date(data.expiresAt!).toISOString()})`,
    });
    if (auditError) console.error("[admin] audit write failed", auditError);

    return { ok: true as const, restrictionId: created.id as string };
  });

/** Admin-only: lift the restriction currently in force on an account. */
export const liftRestriction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; note?: string }) => {
    if (!data?.profileId) throw new Error("An account is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const supabase = context.supabase as any;

    const { data: existing } = await supabase
      .from("account_restrictions")
      .select("id, kind")
      .eq("profile_id", data.profileId)
      .is("lifted_at", null)
      .maybeSingle();
    if (!existing) throw new Error("This account has no active restriction");

    const { error } = await supabase
      .from("account_restrictions")
      .update({
        lifted_at: new Date().toISOString(),
        lifted_by: context.userId,
        lifted_reason: data.note?.trim() ? data.note.trim() : null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);

    const { error: auditError } = await supabase.from("moderation_actions").insert({
      admin_profile_id: context.userId,
      action: "restriction_lifted",
      subject_profile_id: data.profileId,
      restriction_id: existing.id,
      note: data.note?.trim() ? data.note.trim() : null,
      previous_status: `restricted (${existing.kind})`,
      new_status: "unrestricted",
    });
    if (auditError) console.error("[admin] audit write failed", auditError);

    return { ok: true as const };
  });

export interface AdminWarning {
  id: string;
  message: string;
  adminName: string | null;
  createdAt: string;
}

/** Admin-only: visibility status and written warnings for one account. */
export const getAccountWarningsAndVisibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string }) => {
    if (!data?.profileId) throw new Error("A profile is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const supabase = context.supabase as any;
    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from("profiles").select("is_hidden").eq("id", data.profileId).maybeSingle(),
      supabase
        .from("moderation_actions")
        .select("id, note, admin_display_name, created_at")
        .eq("subject_profile_id", data.profileId)
        .eq("action", "warning_issued")
        .order("created_at", { ascending: false }),
    ]);
    return {
      isHidden: Boolean(profile?.is_hidden),
      warnings: ((rows ?? []) as any[]).map(
        (r): AdminWarning => ({ id: r.id, message: r.note ?? "", adminName: r.admin_display_name ?? null, createdAt: r.created_at }),
      ),
    };
  });

/** Admin-only: issue a written warning (recorded in moderation history + notifies the member). */
export const issueWarning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; message: string }) => {
    const message = String(data?.message ?? "").trim();
    if (!data?.profileId || !message) throw new Error("A warning message is required");
    if (message.length > 1000) throw new Error("Warning message is too long (max 1000 characters)");
    return { profileId: data.profileId, message };
  })
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const { error } = await (context.supabase as any).rpc("admin_issue_warning", {
      _profile_id: data.profileId,
      _message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin-only: hide or unhide a profile from discovery (not a ban). */
export const setProfileHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; hidden: boolean }) => {
    if (!data?.profileId || typeof data.hidden !== "boolean") throw new Error("An account and visibility are required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const { error } = await (context.supabase as any).rpc("admin_set_profile_hidden", {
      _profile_id: data.profileId,
      _hidden: data.hidden,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, hidden: data.hidden };
  });
