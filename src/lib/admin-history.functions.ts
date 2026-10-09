/**
 * Admin → Action History. Read-only view over the existing moderation_actions
 * audit table. Every call re-verifies is_admin() server-side; no writes exist here.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModeratorContext } from "./admin.functions";

export const HISTORY_PAGE_SIZE = 25;

export type HistoryRange = "all" | "today" | "7d" | "30d";

export interface HistoryRow {
  id: string;
  action: string;
  createdAt: string;
  note: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  adminProfileId: string | null;
  adminName: string | null;
  subjectProfileId: string | null;
  subjectName: string | null;
  subjectType: "player" | "club" | null;
  subjectExists: boolean;
  report: { reason: string | null; kind: string | null; status: string | null; details: string | null; messageBody: string | null } | null;
  restriction: { kind: string | null; reason: string | null; expiresAt: string | null } | null;
}

function cleanSearch(v: string) {
  // Strip characters that have meaning in PostgREST filter syntax.
  return v.replace(/[%,()*\\"'.:]/g, " ").trim().slice(0, 100);
}

export const listActionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page?: number; search?: string; action?: string; adminId?: string; range?: HistoryRange }) => ({
    page: Math.max(0, Math.min(10000, Math.floor(Number(d?.page) || 0))),
    search: typeof d?.search === "string" ? cleanSearch(d.search) : "",
    action: typeof d?.action === "string" && /^[a-z_]{1,60}$/.test(d.action) ? d.action : "",
    adminId: typeof d?.adminId === "string" && /^[0-9a-f-]{36}$/i.test(d.adminId) ? d.adminId : "",
    range: (["all", "today", "7d", "30d"] as const).includes(d?.range as HistoryRange) ? (d.range as HistoryRange) : "all",
  }))
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const supabase = context.supabase as any;
    let q = supabase
      .from("moderation_actions")
      .select(
        `id, action, created_at, note, previous_status, new_status, admin_profile_id, admin_display_name,
         subject_profile_id, subject_display_name,
         subject:profiles!moderation_actions_subject_profile_id_fkey(display_name, account_type),
         admin:profiles!moderation_actions_admin_profile_id_fkey(display_name),
         report:reports!moderation_actions_report_id_fkey(reason, kind, status, details, message_body),
         restriction:account_restrictions!moderation_actions_restriction_id_fkey(kind, reason, expires_at)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * HISTORY_PAGE_SIZE, data.page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE - 1);

    if (data.action) q = q.eq("action", data.action);
    if (data.adminId) q = q.eq("admin_profile_id", data.adminId);
    if (data.range !== "all") {
      const since = new Date();
      if (data.range === "today") since.setUTCHours(0, 0, 0, 0);
      else since.setTime(since.getTime() - (data.range === "7d" ? 7 : 30) * 86400000);
      q = q.gte("created_at", since.toISOString());
    }
    if (data.search) {
      const t = `*${data.search}*`;
      // Names of still-existing accounts live on profiles; look those up too.
      const { data: people } = await supabase.from("profiles").select("id").ilike("display_name", `%${data.search}%`).limit(200);
      const ids = ((people ?? []) as { id: string }[]).map((p) => p.id);
      const parts = [
        `action.ilike.${t}`, `note.ilike.${t}`, `subject_display_name.ilike.${t}`,
        `admin_display_name.ilike.${t}`, `previous_status.ilike.${t}`, `new_status.ilike.${t}`,
      ];
      if (ids.length) {
        parts.push(`subject_profile_id.in.(${ids.join(",")})`, `admin_profile_id.in.(${ids.join(",")})`);
      }
      q = q.or(parts.join(","));
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const items: HistoryRow[] = ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      action: r.action,
      createdAt: r.created_at,
      note: r.note ?? null,
      previousStatus: r.previous_status ?? null,
      newStatus: r.new_status ?? null,
      adminProfileId: r.admin_profile_id ?? null,
      adminName: r.admin?.display_name ?? r.admin_display_name ?? null,
      subjectProfileId: r.subject_profile_id ?? null,
      subjectName: r.subject?.display_name ?? r.subject_display_name ?? null,
      subjectType: r.subject?.account_type ?? null,
      subjectExists: Boolean(r.subject_profile_id && r.subject),
      report: r.report
        ? { reason: r.report.reason, kind: r.report.kind, status: r.report.status, details: r.report.details, messageBody: r.report.message_body }
        : null,
      restriction: r.restriction ? { kind: r.restriction.kind, reason: r.restriction.reason, expiresAt: r.restriction.expires_at } : null,
    }));
    return { items, total: count ?? 0, pageSize: HISTORY_PAGE_SIZE };
  });

/** Filter options drawn only from what exists: recorded action types and current admins. */
export const getActionHistoryFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModeratorContext(context);
    const supabase = context.supabase as any;
    const [{ data: actions }, { data: adminIds }] = await Promise.all([
      supabase.from("moderation_actions").select("action, admin_profile_id").limit(10000),
      supabase.rpc("admin_list_admin_ids"),
    ]);
    const types = Array.from(new Set(((actions ?? []) as { action: string }[]).map((a) => a.action))).sort();
    // Moderators can't list admins; they see the staff who appear in entries visible to them.
    const ids = Array.from(new Set([
      ...(((adminIds ?? []) as any[]).map((x) => (typeof x === "string" ? x : Object.values(x)[0])) as string[]),
      ...(((actions ?? []) as { admin_profile_id: string | null }[]).map((a) => a.admin_profile_id).filter(Boolean) as string[]),
    ]));
    let admins: { id: string; name: string }[] = [];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      admins = ((profs ?? []) as any[]).map((p) => ({ id: p.id, name: p.display_name })).sort((a, b) => a.name.localeCompare(b.name));
    }
    return { actionTypes: types, admins };
  });
