/**
 * Admin Trial Invites (read-only, administrators only).
 *
 * Security model: requireSupabaseAuth identifies the caller from the verified
 * bearer token, requireAdminContext re-checks public.is_admin() in the database,
 * and only then is the service-role client loaded (inside the handler) to read
 * across accounts. No RLS policy is broadened and nothing is written.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

export type AdminTrialParty = {
  id: string | null;
  name: string;
  state: "ok" | "hidden" | "deleted";
};

export type AdminTrialInvite = {
  id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  trialDate: string;
  startTime: string;
  endTime: string;
  arrivalTime: string | null;
  surface: string;
  surfaceOther: string | null;
  venueName: string;
  streetAddress: string;
  postcode: string;
  whatToBring: string | null;
  kitInstructions: string | null;
  changingInfo: string | null;
  additionalInstructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  declineReason: string | null;
  respondedAt: string | null;
  createdAt: string;
  player: AdminTrialParty;
  club: AdminTrialParty;
  vacancy: { id: string; title: string | null; positions: string[]; status: string } | null;
  application: { id: string; stage: string; createdAt: string } | null;
  outcome: { outcome: "signed" | "not_signed"; createdAt: string } | null;
};

export const listAdminTrialInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTrialInvite[]> => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: invites, error } = await db
      .from("trial_invites")
      .select(
        "id, status, trial_date, start_time, end_time, arrival_time, surface, surface_other, venue_name, street_address, postcode, what_to_bring, kit_instructions, changing_info, additional_instructions, contact_name, contact_phone, notes, decline_reason, responded_at, created_at, player_id, club_id, vacancy_id, application_id",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Could not load trial invites");
    const rows = (invites ?? []) as any[];
    if (!rows.length) return [];

    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])];
    const profileIds = uniq(rows.flatMap((r) => [r.player_id, r.club_id]));
    const vacancyIds = uniq(rows.map((r) => r.vacancy_id));
    const appIds = uniq(rows.map((r) => r.application_id));

    const [profilesRes, clubsRes, vacRes, appRes, outRes] = await Promise.all([
      db.from("profiles").select("id, display_name, is_hidden").in("id", profileIds),
      db.from("clubs").select("id, name").in("id", profileIds),
      vacancyIds.length
        ? db.from("vacancies").select("id, title, positions, status").in("id", vacancyIds)
        : Promise.resolve({ data: [] }),
      appIds.length
        ? db.from("applications").select("id, stage, created_at").in("id", appIds)
        : Promise.resolve({ data: [] }),
      db.from("trial_outcomes").select("trial_invite_id, outcome, created_at").in("trial_invite_id", rows.map((r) => r.id)),
    ]);
    const { data: restrictions } = await db
      .from("account_restrictions")
      .select("profile_id, expires_at")
      .in("profile_id", profileIds)
      .is("lifted_at", null);

    const now = Date.now();
    const restricted = new Set(
      ((restrictions ?? []) as any[])
        .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
        .map((r) => r.profile_id),
    );
    const profiles = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.id, p]));
    const clubs = new Map(((clubsRes.data ?? []) as any[]).map((c) => [c.id, c]));
    const vacancies = new Map(((vacRes.data ?? []) as any[]).map((v) => [v.id, v]));
    const apps = new Map(((appRes.data ?? []) as any[]).map((a) => [a.id, a]));
    const outcomes = new Map(((outRes.data ?? []) as any[]).map((o) => [o.trial_invite_id, o]));

    const party = (id: string | null, kind: "Player" | "Club"): AdminTrialParty => {
      const p = id ? profiles.get(id) : null;
      if (!id || !p) return { id: null, name: `Deleted ${kind}`, state: "deleted" };
      const name = (kind === "Club" ? clubs.get(id)?.name : null) || p.display_name || kind;
      return { id, name, state: p.is_hidden || restricted.has(id) ? "hidden" : "ok" };
    };

    return rows.map((r) => {
      const v = r.vacancy_id ? vacancies.get(r.vacancy_id) : null;
      const a = r.application_id ? apps.get(r.application_id) : null;
      const o = outcomes.get(r.id);
      return {
        id: r.id,
        status: r.status,
        trialDate: r.trial_date,
        startTime: String(r.start_time ?? "").slice(0, 5),
        endTime: String(r.end_time ?? "").slice(0, 5),
        arrivalTime: r.arrival_time ? String(r.arrival_time).slice(0, 5) : null,
        surface: r.surface,
        surfaceOther: r.surface_other,
        venueName: r.venue_name,
        streetAddress: r.street_address,
        postcode: r.postcode,
        whatToBring: r.what_to_bring,
        kitInstructions: r.kit_instructions,
        changingInfo: r.changing_info,
        additionalInstructions: r.additional_instructions,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
        notes: r.notes,
        declineReason: r.decline_reason,
        respondedAt: r.responded_at,
        createdAt: r.created_at,
        player: party(r.player_id, "Player"),
        club: party(r.club_id, "Club"),
        vacancy: v
          ? { id: v.id, title: v.title ?? null, positions: v.positions ?? [], status: v.status }
          : null,
        application: a ? { id: a.id, stage: a.stage, createdAt: a.created_at } : null,
        outcome: o ? { outcome: o.outcome, createdAt: o.created_at } : null,
      };
    });
  });
