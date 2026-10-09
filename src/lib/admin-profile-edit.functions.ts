/**
 * Admin profile editing.
 *
 * Security model (same as the other admin server functions):
 * - requireSupabaseAuth identifies the caller from the verified bearer token.
 * - requireAdminContext re-checks public.is_admin() in the database on every call.
 * - Only after that check is the service-role client loaded (inside the handler)
 *   to read/write another member's profile rows.
 * - Only whitelisted profile columns can be written. account_type, football
 *   section, verification, Owner Status, Founder Club and roles are never touched.
 * - Only columns whose value actually changed are written, and each save is
 *   recorded as ONE moderation_actions row listing field / old value / new value.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

const positions = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"] as const;
const availability = ["actively_looking", "open_to_offers", "not_looking"] as const;
const trainingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const recruitment = ["open", "selective", "closed"] as const;
const feePolicies = ["listed", "none", "varies"] as const;

const text = (max: number) => z.string().max(max).transform((v) => v.trim());
const optionalFee = z.number().min(0).max(100000).nullable();

export const adminPlayerSchema = z.object({
  displayName: text(120).refine((v) => v.length > 0, "Name is required"),
  dateOfBirth: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date of birth"),
  heightInches: z.number().int().min(48).max(90).nullable(),
  location: text(120),
  currentClubName: text(120),
  levelId: z.number().int().positive().nullable(),
  preferredLevelId: z.number().int().positive().nullable(),
  primaryPosition: z.enum(positions).nullable(),
  secondaryPositions: z.array(z.enum(positions)).max(10),
  availability: z.enum(availability),
  preferredTrainingDays: z.array(z.enum(trainingDays)).max(7),
  maxTravelMiles: z.number().int().min(0).max(500).nullable(),
  openToTrials: z.boolean(),
  bio: text(4000),
  lookingFor: text(2000),
});
export type AdminPlayerForm = z.input<typeof adminPlayerSchema>;

export const adminClubSchema = z.object({
  name: text(120).refine((v) => v.length > 0, "Club name is required"),
  shortName: text(10),
  location: text(120),
  homeGround: text(120),
  league: text(120),
  levelId: z.number().int().positive().nullable(),
  founded: text(20),
  description: text(4000),
  trainingDays: z.array(z.enum(trainingDays)).max(7),
  trainingLocation: text(160),
  trainingTime: text(60),
  matchDay: text(60),
  contactName: text(120),
  contactRole: text(120),
  contactEmail: text(200).refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Invalid contact email",
  ),
  recruitmentStatus: z.enum(recruitment),
  feesPolicy: z.enum(feePolicies).nullable(),
  matchSubsFee: optionalFee,
  monthlyFee: optionalFee,
  yearlyFee: optionalFee,
  otherFee: optionalFee,
  otherFeeLabel: text(80),
  facilities: z.array(z.string().max(60)).max(30),
  facilitiesOther: text(300),
});
export type AdminClubForm = z.input<typeof adminClubSchema>;

type Table = "profiles" | "players" | "clubs" | "player_private";
type FieldDef = { key: string; label: string; table: Table; column: string };

const playerFields: FieldDef[] = [
  { key: "displayName", label: "Name", table: "profiles", column: "display_name" },
  { key: "dateOfBirth", label: "Date of birth", table: "player_private", column: "date_of_birth" },
  { key: "heightInches", label: "Height (inches)", table: "players", column: "height_inches" },
  { key: "location", label: "Location", table: "players", column: "location" },
  { key: "currentClubName", label: "Current club", table: "players", column: "current_club_name" },
  { key: "levelId", label: "Current level", table: "players", column: "level_id" },
  { key: "preferredLevelId", label: "Preferred level", table: "players", column: "preferred_level_id" },
  { key: "primaryPosition", label: "Primary position", table: "players", column: "primary_position" },
  { key: "secondaryPositions", label: "Secondary positions", table: "players", column: "secondary_positions" },
  { key: "availability", label: "Availability", table: "players", column: "availability" },
  { key: "preferredTrainingDays", label: "Preferred training days", table: "players", column: "preferred_training_days" },
  { key: "maxTravelMiles", label: "Maximum travel (miles)", table: "players", column: "max_travel_miles" },
  { key: "openToTrials", label: "Open to trials", table: "players", column: "open_to_trials" },
  { key: "bio", label: "Bio", table: "players", column: "bio" },
  { key: "lookingFor", label: "Looking for", table: "players", column: "looking_for" },
];

const clubFields: FieldDef[] = [
  { key: "name", label: "Club name", table: "clubs", column: "name" },
  { key: "shortName", label: "Short name", table: "clubs", column: "short_name" },
  { key: "location", label: "Location", table: "clubs", column: "location" },
  { key: "homeGround", label: "Home ground", table: "clubs", column: "home_ground" },
  { key: "league", label: "League", table: "clubs", column: "league" },
  { key: "levelId", label: "Level", table: "clubs", column: "level_id" },
  { key: "founded", label: "Founded", table: "clubs", column: "founded" },
  { key: "description", label: "About", table: "clubs", column: "description" },
  { key: "trainingDays", label: "Training days", table: "clubs", column: "training_days" },
  { key: "trainingLocation", label: "Training location", table: "clubs", column: "training_location" },
  { key: "trainingTime", label: "Training time", table: "clubs", column: "training_time" },
  { key: "matchDay", label: "Match days", table: "clubs", column: "match_day" },
  { key: "contactName", label: "Contact name", table: "clubs", column: "contact_name" },
  { key: "contactRole", label: "Contact role", table: "clubs", column: "contact_role" },
  { key: "contactEmail", label: "Contact email", table: "clubs", column: "contact_email" },
  { key: "recruitmentStatus", label: "Recruitment status", table: "clubs", column: "recruitment_status" },
  { key: "feesPolicy", label: "Fees policy", table: "clubs", column: "fees_policy" },
  { key: "matchSubsFee", label: "Match subs (£)", table: "clubs", column: "match_subs_fee" },
  { key: "monthlyFee", label: "Monthly fee (£)", table: "clubs", column: "monthly_fee" },
  { key: "yearlyFee", label: "Yearly fee (£)", table: "clubs", column: "yearly_fee" },
  { key: "otherFee", label: "Other fee (£)", table: "clubs", column: "other_fee" },
  { key: "otherFeeLabel", label: "Other fee label", table: "clubs", column: "other_fee_label" },
  { key: "facilities", label: "Facilities", table: "clubs", column: "facilities" },
  { key: "facilitiesOther", label: "Other facilities", table: "clubs", column: "facilities_other" },
];

function toAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Converts a form value into the value stored in the database column. */
function toDb(key: string, value: unknown): unknown {
  if (typeof value === "string") return value === "" ? null : value;
  return value ?? null;
}

function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (Array.isArray(v) ? [...v].map(String).sort() : v ?? null);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

async function loadCurrent(profileId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type, display_name")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Account not found");

  if (profile.account_type === "player") {
    const [{ data: p, error: pe }, { data: priv, error: ve }] = await Promise.all([
      supabaseAdmin.from("players").select("*").eq("id", profileId).maybeSingle(),
      supabaseAdmin.from("player_private").select("date_of_birth").eq("player_id", profileId).maybeSingle(),
    ]);
    if (pe) throw new Error(pe.message);
    if (ve) throw new Error(ve.message);
    const values: AdminPlayerForm = {
      displayName: profile.display_name ?? "",
      dateOfBirth: priv?.date_of_birth ?? "",
      heightInches: p?.height_inches ?? null,
      location: p?.location ?? "",
      currentClubName: p?.current_club_name ?? "",
      levelId: p?.level_id ?? null,
      preferredLevelId: p?.preferred_level_id ?? null,
      primaryPosition: (p?.primary_position as AdminPlayerForm["primaryPosition"]) ?? null,
      secondaryPositions: ((p?.secondary_positions ?? []) as AdminPlayerForm["secondaryPositions"]).filter(Boolean),
      availability: (p?.availability as AdminPlayerForm["availability"]) ?? "open_to_offers",
      preferredTrainingDays: ((p?.preferred_training_days ?? []) as AdminPlayerForm["preferredTrainingDays"]).filter(
        (d) => (trainingDays as readonly string[]).includes(d),
      ),
      maxTravelMiles: p?.max_travel_miles ?? null,
      openToTrials: p?.open_to_trials ?? true,
      bio: p?.bio ?? "",
      lookingFor: p?.looking_for ?? "",
    };
    return { supabaseAdmin, profile, kind: "player" as const, values, hasPrivateRow: !!priv };
  }

  const { data: c, error: ce } = await supabaseAdmin.from("clubs").select("*").eq("id", profileId).maybeSingle();
  if (ce) throw new Error(ce.message);
  const status = (c?.recruitment_status ?? "open") as string;
  const values: AdminClubForm = {
    name: c?.name ?? profile.display_name ?? "",
    shortName: c?.short_name ?? "",
    location: c?.location ?? "",
    homeGround: c?.home_ground ?? "",
    league: c?.league ?? "",
    levelId: c?.level_id ?? null,
    founded: c?.founded ?? "",
    description: c?.description ?? "",
    trainingDays: ((c?.training_days ?? []) as AdminClubForm["trainingDays"]).filter((d) =>
      (trainingDays as readonly string[]).includes(d),
    ),
    trainingLocation: c?.training_location ?? "",
    trainingTime: c?.training_time ?? "",
    matchDay: c?.match_day ?? "",
    contactName: c?.contact_name ?? "",
    contactRole: c?.contact_role ?? "",
    contactEmail: c?.contact_email ?? "",
    recruitmentStatus: (recruitment as readonly string[]).includes(status)
      ? (status as AdminClubForm["recruitmentStatus"])
      : "open",
    feesPolicy: (feePolicies as readonly string[]).includes(c?.fees_policy ?? "")
      ? (c!.fees_policy as AdminClubForm["feesPolicy"])
      : null,
    matchSubsFee: toAmount(c?.match_subs_fee),
    monthlyFee: toAmount(c?.monthly_fee),
    yearlyFee: toAmount(c?.yearly_fee),
    otherFee: toAmount(c?.other_fee),
    otherFeeLabel: c?.other_fee_label ?? "",
    facilities: ((c?.facilities ?? []) as string[]).filter(Boolean),
    facilitiesOther: c?.facilities_other ?? "",
  };
  return { supabaseAdmin, profile, kind: "club" as const, values, hasPrivateRow: true };
}

/** Loads the editable profile values for any player or club (admin only). */
export const getAdminEditableProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ profileId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const current = await loadCurrent(data.profileId);
    return current.kind === "player"
      ? { kind: "player" as const, player: current.values as AdminPlayerForm, club: null }
      : { kind: "club" as const, player: null, club: current.values as AdminClubForm };
  });

const saveInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("player"), profileId: z.string().uuid(), values: adminPlayerSchema }),
  z.object({ kind: z.literal("club"), profileId: z.string().uuid(), values: adminClubSchema }),
]);

/** Saves only the changed fields and records one audit entry (admin only). */
export const saveAdminProfileEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdminContext(context);
    const current = await loadCurrent(data.profileId);
    // The account type is never changed; a mismatched request is refused.
    if (current.kind !== data.kind) throw new Error("Account type mismatch — nothing was changed.");

    const next: Record<string, unknown> = { ...data.values };
    if (data.kind === "club" && next["feesPolicy"] !== "listed") {
      // Same rule as the club's own editor: amounts only exist for listed fees.
      for (const k of ["matchSubsFee", "monthlyFee", "yearlyFee", "otherFee"]) next[k] = null;
      next["otherFeeLabel"] = "";
    }
    if (data.kind === "player" && next["dateOfBirth"]) {
      const dob = new Date(String(next["dateOfBirth"]));
      const limit = new Date();
      limit.setFullYear(limit.getFullYear() - 16);
      if (Number.isNaN(dob.getTime()) || dob > limit) throw new Error("Players must be 16 or over.");
    }

    const fields = data.kind === "player" ? playerFields : clubFields;
    const prev = current.values as Record<string, unknown>;
    const changes = fields.filter((f) => !same(toDb(f.key, prev[f.key]), toDb(f.key, next[f.key])));
    if (changes.length === 0) return { changed: [] as string[] };

    const updates: Partial<Record<Table, Record<string, unknown>>> = {};
    for (const f of changes) {
      (updates[f.table] ??= {})[f.column] = toDb(f.key, next[f.key]);
    }
    // Club name is mirrored onto the profile display name, as in the club's own editor.
    if (data.kind === "club" && updates.clubs?.["name"] !== undefined) {
      updates.profiles = { ...(updates.profiles ?? {}), display_name: updates.clubs["name"] };
    }

    const db = current.supabaseAdmin as any;
    for (const table of ["profiles", "players", "clubs"] as const) {
      const patch = updates[table];
      if (!patch) continue;
      const { error } = await db.from(table).update(patch).eq("id", data.profileId);
      if (error) throw new Error(error.message);
    }
    if (updates.player_private) {
      const { error } = current.hasPrivateRow
        ? await db.from("player_private").update(updates.player_private).eq("player_id", data.profileId)
        : await db.from("player_private").insert({ player_id: data.profileId, ...updates.player_private });
      if (error) throw new Error(error.message);
    }

    const { data: actor } = await db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    const newName = (updates.profiles?.["display_name"] as string | undefined) ?? current.profile.display_name;
    const { error: auditError } = await context.supabase.from("moderation_actions").insert({
      admin_profile_id: context.userId,
      admin_display_name: actor?.display_name ?? null,
      action: "profile_edited",
      subject_profile_id: data.profileId,
      subject_display_name: newName,
      previous_status: changes.map((f) => `${f.label}: ${show(prev[f.key])}`).join("; "),
      new_status: changes.map((f) => `${f.label}: ${show(next[f.key])}`).join("; "),
      note: `Admin edited ${current.kind} profile — changed: ${changes.map((f) => f.label).join(", ")}`,
    });
    if (auditError) {
      console.error("[admin-profile-edit] audit insert failed", auditError);
      throw new Error("Profile saved, but the action history entry could not be recorded.");
    }

    return { changed: changes.map((f) => f.label) };
  });

export const adminPlayerFieldLabels = Object.fromEntries(playerFields.map((f) => [f.key, f.label]));
export const adminClubFieldLabels = Object.fromEntries(clubFields.map((f) => [f.key, f.label]));
