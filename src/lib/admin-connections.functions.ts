/**
 * Admin Successful Connections (read-only, administrators only).
 *
 * Same security model as admin-trials.functions.ts: requireSupabaseAuth
 * identifies the caller, requireAdminContext re-checks public.is_admin(), and
 * only then is the service-role client loaded inside the handler. Nothing is
 * written and no RLS policy is broadened.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

export type AdminConnectionParty = {
  id: string | null;
  name: string;
  deleted: boolean;
  hidden: boolean;
  banned: boolean;
  /** Current account type differs from the role held in this connection. */
  switchedTo: "player" | "club" | null;
};

export type AdminConnection = {
  id: string;
  createdAt: string;
  player: AdminConnectionParty;
  playerPosition: string | null;
  club: AdminConnectionParty;
  vacancy: { id: string; title: string | null; positions: string[]; status: string } | null;
  trialDate: string | null;
  inviteStatus: string | null;
};

export const listAdminSuccessfulConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminConnection[]> => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: outcomes, error } = await db
      .from("trial_outcomes")
      .select("id, created_at, player_id, club_id, vacancy_id, trial_invite_id")
      .eq("outcome", "signed")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Could not load successful connections");
    const rows = (outcomes ?? []) as any[];
    if (!rows.length) return [];

    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])];
    const profileIds = uniq(rows.flatMap((r) => [r.player_id, r.club_id]));
    const vacancyIds = uniq(rows.map((r) => r.vacancy_id));
    const inviteIds = uniq(rows.map((r) => r.trial_invite_id));

    const [profilesRes, clubsRes, playersRes, vacRes, invRes, restrRes] = await Promise.all([
      db.from("profiles").select("id, display_name, is_hidden, account_type").in("id", profileIds),
      db.from("clubs").select("id, name").in("id", profileIds),
      db.from("players").select("id, primary_position").in("id", profileIds),
      vacancyIds.length
        ? db.from("vacancies").select("id, title, positions, status").in("id", vacancyIds)
        : Promise.resolve({ data: [] }),
      inviteIds.length
        ? db.from("trial_invites").select("id, trial_date, status").in("id", inviteIds)
        : Promise.resolve({ data: [] }),
      db.from("account_restrictions").select("profile_id, expires_at").in("profile_id", profileIds).is("lifted_at", null),
    ]);

    const now = Date.now();
    const banned = new Set(
      ((restrRes.data ?? []) as any[])
        .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
        .map((r) => r.profile_id),
    );
    const map = (res: any) => new Map(((res.data ?? []) as any[]).map((x) => [x.id, x]));
    const profiles = map(profilesRes);
    const clubs = map(clubsRes);
    const players = map(playersRes);
    const vacancies = map(vacRes);
    const invites = map(invRes);

    const party = (id: string | null, role: "player" | "club"): AdminConnectionParty => {
      const p = id ? profiles.get(id) : null;
      const label = role === "club" ? "Club" : "Player";
      if (!id || !p) {
        return { id: null, name: `Deleted ${label}`, deleted: true, hidden: false, banned: false, switchedTo: null };
      }
      const name = (role === "club" ? clubs.get(id)?.name : null) || p.display_name || label;
      return {
        id,
        name,
        deleted: false,
        hidden: !!p.is_hidden,
        banned: banned.has(id),
        switchedTo: p.account_type && p.account_type !== role ? p.account_type : null,
      };
    };

    return rows.map((r) => {
      const v = r.vacancy_id ? vacancies.get(r.vacancy_id) : null;
      const inv = r.trial_invite_id ? invites.get(r.trial_invite_id) : null;
      return {
        id: r.id,
        createdAt: r.created_at,
        player: party(r.player_id, "player"),
        playerPosition: r.player_id ? players.get(r.player_id)?.primary_position ?? null : null,
        club: party(r.club_id, "club"),
        vacancy: v ? { id: v.id, title: v.title ?? null, positions: v.positions ?? [], status: v.status } : null,
        trialDate: inv?.trial_date ?? null,
        inviteStatus: inv?.status ?? null,
      };
    });
  });
