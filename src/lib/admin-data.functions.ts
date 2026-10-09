/**
 * Admin data access.
 *
 * EVERY function here runs requireSupabaseAuth (verified bearer token) and then
 * requireAdminContext (public.is_admin() in the database). Queries and writes go
 * through context.supabase, so Row Level Security and the verification /
 * Founder Club protection triggers apply on top. Nothing trusts the browser.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext, requireModeratorContext } from "./admin.functions";

export type AdminAccountType = "player" | "club";
export type AdminVerification = "unverified" | "pending" | "verified" | "rejected";
export type AdminReportStatus = "open" | "resolved" | "dismissed";
export type AdminSection = "mens" | "womens" | "both";

export interface AdminUserRow {
  id: string;
  displayName: string;
  accountType: AdminAccountType;
  verification: AdminVerification;
  createdAt: string;
  email: string | null;
  lastSignInAt: string | null;
  /** BallFindr re-verification status (NOT Supabase email_confirmed_at). Null for moderators. */
  emailReverification: "not_verified" | "sent" | "reverified" | null;
  /** Supabase confirmation email has been sent (auth confirmation_sent_at). Null for moderators. */
  emailConfirmationSent: boolean | null;
  location: string | null;
  /** Club: league. Player: current club. */
  detail: string | null;
  isFounderClub: boolean;
  isOwner: boolean;
  openReports: number;
  /** Men's or Women's football section (null only if the record is missing). */
  section: AdminSection | null;
}

export type AdminReportKind = "profile" | "message";

export interface AdminReportRow {
  id: string;
  kind: AdminReportKind;
  status: AdminReportStatus;
  reason: string;
  details: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  /** Null once the reported account has been permanently deleted. */
  reportedProfileId: string | null;
  reportedName: string;
  reportedType: AdminAccountType | null;
  reportedSection: AdminSection | null;
  reporterProfileId: string | null;
  reporterName: string | null;
  /** Message reports only: evidence snapshotted by the database at insert time. */
  conversationId: string | null;
  messageBody: string | null;
  messageSentAt: string | null;
  /** Restriction currently in force on the reported account, if any. */
  restriction: { kind: "temporary" | "permanent"; expiresAt: string | null } | null;
}

type ProfileRow = {
  id: string;
  display_name: string;
  account_type: string;
  created_at: string;
  verification_status: string;
  is_owner: boolean;
};

function section(value: unknown): AdminSection | null {
  return value === "womens" || value === "mens" || value === "both"
    ? (value as AdminSection)
    : null;
}

function accountType(value: string): AdminAccountType {
  return value === "club" ? "club" : "player";
}

function verification(value: string | null | undefined): AdminVerification {
  return value === "verified" || value === "pending" || value === "rejected" ? value : "unverified";
}

/** auth.users holds the email; only reachable with the service role, after the admin check. */
async function emailsById(): Promise<Map<string, { email: string | null; lastSignInAt: string | null; emailConfirmed: boolean; confirmationSent: boolean }>> {
  const map = new Map<string, { email: string | null; lastSignInAt: string | null; emailConfirmed: boolean; confirmationSent: boolean }>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const user of data.users) {
        map.set(user.id, {
          email: user.email ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
          emailConfirmed: Boolean(user.email_confirmed_at),
          confirmationSent: Boolean(user.confirmation_sent_at),
        });
      }
      if (data.users.length < 200) break;
    }
  } catch (err) {
    console.error("[admin] could not read account emails", err);
  }
  return map;
}

async function loadUserRows(supabase: any, withEmails = true): Promise<AdminUserRow[]> {
  const [{ data: profiles }, { data: players }, { data: clubs }, { data: reports }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, account_type, created_at, verification_status, is_owner")
      .order("created_at", { ascending: false }),
    supabase.from("player_cards").select("id, location, current_club_name, football_section"),
    supabase.from("clubs").select("id, location, league, is_founder_club, football_section"),
    supabase.from("reports").select("reported_profile_id, status").eq("status", "open"),
  ]);

  const playerById = new Map<string, any>((players ?? []).map((p: any) => [p.id, p]));
  const clubById = new Map<string, any>((clubs ?? []).map((c: any) => [c.id, c]));
  const openReports = new Map<string, number>();
  for (const report of reports ?? []) {
    const key = (report as any).reported_profile_id as string;
    openReports.set(key, (openReports.get(key) ?? 0) + 1);
  }
  // Account emails are admin-only; moderators never receive them.
  const auth = withEmails ? await emailsById() : new Map<string, { email: string | null; lastSignInAt: string | null; emailConfirmed: boolean; confirmationSent: boolean }>();
  const reverify = new Map<string, string>();
  if (withEmails) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rv } = await (supabaseAdmin as any).from("email_reverifications").select("profile_id, status");
    for (const r of rv ?? []) reverify.set(r.profile_id, r.status);
  }

  return ((profiles ?? []) as ProfileRow[]).map((profile) => {
    const type = accountType(profile.account_type);
    const player = playerById.get(profile.id);
    const club = clubById.get(profile.id);
    const account = auth.get(profile.id);
    return {
      id: profile.id,
      displayName: profile.display_name,
      accountType: type,
      verification: verification(profile.verification_status),
      createdAt: profile.created_at,
      email: account?.email ?? null,
      lastSignInAt: account?.lastSignInAt ?? null,
      emailReverification: withEmails ? ((reverify.get(profile.id) as any) ?? "not_verified") : null,
      emailConfirmationSent: withEmails ? (account?.confirmationSent ?? false) : null,
      location: (type === "club" ? club?.location : player?.location) ?? null,
      detail: (type === "club" ? club?.league : player?.current_club_name) ?? null,
      isFounderClub: Boolean(club?.is_founder_club),
      isOwner: Boolean(profile.is_owner),
      openReports: openReports.get(profile.id) ?? 0,
      section: section(type === "club" ? club?.football_section : player?.football_section),
    };
  });
}

/** Every registered account, newest first. */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await requireModeratorContext(context);
    return loadUserRows(context.supabase, role === "admin");
  });

function mapReports(
  rows: any[],
  nameById: Map<string, ProfileRow>,
  restrictionByProfile?: Map<string, { kind: "temporary" | "permanent"; expiresAt: string | null }>,
  sectionByProfile?: Map<string, AdminSection | null>,
): AdminReportRow[] {
  return rows.map((row) => {
    const reported = row.reported_profile_id ? nameById.get(row.reported_profile_id) : undefined;
    const reporter = row.reporter_profile_id ? nameById.get(row.reporter_profile_id) : undefined;
    const deletedSuffix = (name: string | null) => (name ? `${name} (deleted account)` : "Deleted account");
    return {
      id: row.id,
      kind: (row.kind === "message" ? "message" : "profile") as AdminReportKind,
      status: (row.status ?? "open") as AdminReportStatus,
      reason: row.reason,
      details: row.details ?? null,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at ?? null,
      resolutionNotes: row.resolution_notes ?? null,
      reportedProfileId: row.reported_profile_id ?? null,
      reportedName: reported?.display_name ?? deletedSuffix(row.reported_display_name ?? null),
      reportedType: reported ? accountType(reported.account_type) : null,
      reportedSection: row.reported_profile_id
        ? (sectionByProfile?.get(row.reported_profile_id) ?? null)
        : null,
      reporterProfileId: row.reporter_profile_id ?? null,
      reporterName:
        reporter?.display_name ??
        (row.reporter_display_name ? deletedSuffix(row.reporter_display_name) : null),
      conversationId: row.conversation_id ?? null,
      messageBody: row.message_body ?? null,
      messageSentAt: row.message_sent_at ?? null,
      restriction: row.reported_profile_id
        ? (restrictionByProfile?.get(row.reported_profile_id) ?? null)
        : null,
    };
  });
}

/** Active restrictions keyed by account, used to badge report and user rows. */
async function activeRestrictionMap(supabase: any) {
  const map = new Map<string, { kind: "temporary" | "permanent"; expiresAt: string | null }>();
  const { data } = await supabase
    .from("account_restrictions")
    .select("profile_id, kind, expires_at, lifted_at")
    .is("lifted_at", null);
  for (const row of (data ?? []) as any[]) {
    const expired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : false;
    if (expired) continue;
    map.set(row.profile_id, {
      kind: row.kind === "permanent" ? "permanent" : "temporary",
      expiresAt: row.expires_at ?? null,
    });
  }
  return map;
}

/** Football section for every account, used to label reports and moderation. */
async function sectionMap(supabase: any): Promise<Map<string, AdminSection | null>> {
  const [{ data: players }, { data: clubs }] = await Promise.all([
    supabase.from("players").select("id, football_section"),
    supabase.from("clubs").select("id, football_section"),
  ]);
  const map = new Map<string, AdminSection | null>();
  for (const row of [...((players ?? []) as any[]), ...((clubs ?? []) as any[])]) {
    map.set(row.id, section(row.football_section));
  }
  return map;
}

async function loadReports(supabase: any): Promise<AdminReportRow[]> {
  const [restrictions, sections] = await Promise.all([
    activeRestrictionMap(supabase),
    sectionMap(supabase),
  ]);
  const [{ data: reports }, { data: profiles }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, kind, status, reason, details, created_at, resolved_at, resolution_notes, reported_profile_id, reported_display_name, reporter_profile_id, reporter_display_name, conversation_id, message_id, message_body, message_sent_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name, account_type, created_at, verification_status, is_owner"),
  ]);
  const nameById = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  return mapReports(reports ?? [], nameById, restrictions, sections);
}

export const listAdminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModeratorContext(context);
    return loadReports(context.supabase);
  });

/** Platform statistics plus recent activity, all from live data. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdminContext(context);
    const [users, reports] = await Promise.all([
      loadUserRows(context.supabase),
      loadReports(context.supabase),
    ]);

    const now = Date.now();
    const week = now - 7 * 24 * 60 * 60 * 1000;
    const month = now - 30 * 24 * 60 * 60 * 1000;
    const since = (rows: AdminUserRow[], from: number) =>
      rows.filter((row) => new Date(row.createdAt).getTime() >= from).length;

    const players = users.filter((u) => u.accountType === "player");
    const clubs = users.filter((u) => u.accountType === "club");

    const { data: decisionRows } = await (context.supabase as any).rpc("admin_verification_info");
    const decidedIds = ((decisionRows ?? []) as any[])
      .filter((row) => row.verification_decided_at)
      .sort(
        (a, b) =>
          new Date(b.verification_decided_at).getTime() - new Date(a.verification_decided_at).getTime(),
      )
      .slice(0, 6)
      .map((row) => row.profile_id as string);
    const userById = new Map(users.map((u) => [u.id, u]));
    const decisions = decidedIds
      .map((id) => {
        const user = userById.get(id);
        const info = (decisionRows as any[]).find((row) => row.profile_id === id);
        return user && info
          ? {
              id,
              displayName: user.displayName,
              accountType: user.accountType,
              verification: user.verification,
              decidedAt: info.verification_decided_at as string,
            }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
      stats: {
        totalUsers: users.length,
        totalClubs: clubs.length,
        totalPlayers: players.length,
        newUsersWeek: since(users, week),
        newUsersMonth: since(users, month),
        newClubsWeek: since(clubs, week),
        newPlayersWeek: since(players, week),
        verifiedClubs: clubs.filter((c) => c.verification === "verified").length,
        verifiedPlayers: players.filter((p) => p.verification === "verified").length,
        awaitingVerification: users.filter((u) => u.verification === "pending").length,
        openReports: reports.filter((r) => r.status === "open").length,
        founderClubs: clubs.filter((c) => c.isFounderClub).length,
        mensPlayers: players.filter((p) => p.section === "mens").length,
        // Clubs that operate both sections count on both sides.
        mensClubs: clubs.filter((c) => c.section === "mens" || c.section === "both").length,
        womensPlayers: players.filter((p) => p.section === "womens").length,
        womensClubs: clubs.filter((c) => c.section === "womens" || c.section === "both").length,
        bothClubs: clubs.filter((c) => c.section === "both").length,
      },
      recentUsers: users.slice(0, 6),
      recentClubs: clubs.slice(0, 5),
      recentPlayers: players.slice(0, 5),
      recentReports: reports.slice(0, 5),
      recentVerification: decisions,
    };
  });

/** Full detail for one account, including the records the admin may act on. */
export const getAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string }) => {
    if (!data?.profileId) throw new Error("A profile is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const staffRole = await requireModeratorContext(context);
    const supabase = context.supabase as any;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, display_name, account_type, created_at, verification_status, is_owner")
      .eq("id", data.profileId)
      .maybeSingle();
    if (error || !profile) throw new Error("Account not found");

    const { data: verificationInfo } = await supabase.rpc("admin_verification_info", {
      _profile_id: data.profileId,
    });
    const verificationRow = Array.isArray(verificationInfo) ? verificationInfo[0] : verificationInfo;

    const type = accountType(profile.account_type);
    const [{ data: player }, { data: club }, { data: reportRows }, { data: profiles }] = await Promise.all([
      type === "player"
        ? supabase
            .from("player_cards")
            .select(
              "location, current_club_name, primary_position, secondary_positions, availability, open_to_trials, max_travel_miles, bio, looking_for, football_section",
            )
            .eq("id", data.profileId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      type === "club"
        ? supabase
            .from("clubs")
            .select(
              "name, location, league, home_ground, founded, recruitment_status, contact_name, contact_role, description, is_founder_club, founder_granted_at, founder_granted_by, football_section",
            )
            .eq("id", data.profileId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("reports")
        .select(
          "id, kind, status, reason, details, created_at, resolved_at, resolution_notes, reported_profile_id, reported_display_name, reporter_profile_id, reporter_display_name, conversation_id, message_id, message_body, message_sent_at",
        )
        .eq("reported_profile_id", data.profileId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name, account_type, created_at, verification_status, is_owner"),
    ]);

    const nameById = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    const auth = staffRole === "admin" ? (await emailsById()).get(data.profileId) : undefined;

    return {
      id: profile.id,
      displayName: profile.display_name,
      accountType: type,
      verification: verification(profile.verification_status),
      isOwner: Boolean(profile.is_owner),
      verificationDecidedAt: (verificationRow?.verification_decided_at as string | null) ?? null,
      verificationNotes: (verificationRow?.verification_notes as string | null) ?? null,
      createdAt: profile.created_at as string,
      email: auth?.email ?? null,
      lastSignInAt: auth?.lastSignInAt ?? null,
      section: section((club ?? player)?.football_section),
      player: player ?? null,
      club: club ?? null,
      reports: mapReports(reportRows ?? [], nameById, undefined, await sectionMap(supabase)),
    };
  });

/** Admin-only: set Owner Status independently from verification. */
export const setOwnerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; isOwner: boolean }) => {
    if (!data?.profileId || typeof data.isOwner !== "boolean") throw new Error("An account and status are required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update({ is_owner: data.isOwner })
      .eq("id", data.profileId)
      .select("id, is_owner")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Account not found or status could not be changed");
    return { ok: true as const, isOwner: updated.is_owner };
  });

/** Admin-only: change an account's verification state. */
export const setVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; status: AdminVerification; notes?: string }) => {
    if (!data?.profileId) throw new Error("A profile is required");
    if (!["unverified", "pending", "verified", "rejected"].includes(data.status)) {
      throw new Error("Unknown verification status");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({
        verification_status: data.status,
        verification_decided_at: new Date().toISOString(),
        verification_decided_by: context.userId,
        verification_notes: data.notes?.trim() ? data.notes.trim() : null,
      })
      .eq("id", data.profileId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin-only: grant or remove Founder Club status, recording who and when. */
export const setFounderClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clubId: string; isFounder: boolean }) => {
    if (!data?.clubId) throw new Error("A club is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { error } = await (context.supabase as any)
      .from("clubs")
      .update({
        is_founder_club: data.isFounder,
        founder_granted_at: data.isFounder ? new Date().toISOString() : null,
        founder_granted_by: data.isFounder ? context.userId : null,
      })
      .eq("id", data.clubId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin-only: resolve, dismiss or reopen a report. */
export const updateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reportId: string; status: AdminReportStatus; notes?: string }) => {
    if (!data?.reportId) throw new Error("A report is required");
    if (!["open", "resolved", "dismissed"].includes(data.status)) throw new Error("Unknown report status");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireModeratorContext(context);
    const closing = data.status !== "open";
    const supabase = context.supabase as any;
    const { data: before } = await supabase
      .from("reports")
      .select("status, reported_profile_id")
      .eq("id", data.reportId)
      .maybeSingle();
    const { error } = await supabase
      .from("reports")
      .update({
        status: data.status,
        resolution_notes: data.notes?.trim() ? data.notes.trim() : null,
        resolved_at: closing ? new Date().toISOString() : null,
        resolved_by: closing ? context.userId : null,
      })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);

    const { error: auditError } = await supabase.from("moderation_actions").insert({
      admin_profile_id: context.userId,
      action: `report_${data.status}`,
      subject_profile_id: before?.reported_profile_id ?? null,
      report_id: data.reportId,
      note: data.notes?.trim() ? data.notes.trim() : null,
      previous_status: before?.status ?? null,
      new_status: data.status,
    });
    if (auditError) console.error("[admin] audit write failed", auditError);

    return { ok: true as const };
  });

/** Admin-only: every account holding a staff role (admin or moderator). */
export const listStaffRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdminContext(context);
    const { data, error } = await (context.supabase as any).rpc("admin_list_roles");
    if (error) throw new Error(error.message);
    return ((data ?? []) as { user_id: string; role: string }[]).map((r) => ({
      userId: r.user_id,
      role: (r.role === "admin" ? "admin" : "moderator") as "admin" | "moderator",
    }));
  });

/**
 * Admin-only: set an account's staff role to Admin, Moderator or none. The
 * database re-checks is_admin(), keeps at least one admin, and records the
 * change. Never touches account_type.
 */
export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; role: "admin" | "moderator" | "none" }) => {
    if (!data?.profileId || !["admin", "moderator", "none"].includes(data.role)) {
      throw new Error("An account and a valid role are required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { error } = await (context.supabase as any).rpc("admin_set_role", {
      _profile_id: data.profileId,
      _role: data.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, role: data.role };
  });

/** Admin-only: the profile ids that currently hold the admin role. */
export const listAdminRoleIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdminContext(context);
    const { data, error } = await (context.supabase as any).rpc("admin_list_admin_ids");
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown[]).map((v: any) => (typeof v === "string" ? v : v?.admin_list_admin_ids)) as string[];
  });

/**
 * Admin-only: grant or remove the admin role. The database function re-checks
 * is_admin(), blocks removing the last admin and writes the audit entry.
 * Never touches account_type or any profile data.
 */
export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; grant: boolean }) => {
    if (!data?.profileId || typeof data.grant !== "boolean") throw new Error("An account and role are required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { error } = await (context.supabase as any).rpc("admin_set_admin_role", {
      _profile_id: data.profileId,
      _grant: data.grant,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, isAdmin: data.grant };
  });

/** Admin-only: change a player's (mens/womens) or club's (mens/womens/both) football section. */
export const setFootballSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { profileId: string; section: "mens" | "womens" | "both" }) => {
    if (!data?.profileId || !["mens", "womens", "both"].includes(data.section)) {
      throw new Error("An account and a valid section are required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const { data: result, error } = await (context.supabase as any).rpc("admin_set_football_section", {
      _profile_id: data.profileId,
      _section: data.section,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, section: String(result) };
  });
