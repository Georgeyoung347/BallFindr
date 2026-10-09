/**
 * Trial invitations — real Supabase data on top of the application flow.
 *
 * club → vacancy → application → trial_invites
 *
 * Every row is linked to an application. The database derives club_id,
 * player_id and vacancy_id from that application (never trusted from here),
 * moves the application to the existing "trial" stage, records the application
 * event and sends the player notification — all via triggers. Nothing in this
 * file writes to applications, application_events or notifications directly.
 *
 * RLS: only the involved club or player can read a row; only the club can
 * create / edit / cancel; the player can only accept or decline.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TrialSurface = Database["public"]["Enums"]["trial_surface"];
export type TrialInviteStatus = Database["public"]["Enums"]["trial_invite_status"];

export const trialSurfaceOptions: { value: TrialSurface; label: string }[] = [
  { value: "grass", label: "Grass" },
  { value: "3g", label: "3G" },
  { value: "4g", label: "4G" },
  { value: "astro", label: "Astro" },
  { value: "other", label: "Other" },
];

export function surfaceLabel(surface: TrialSurface, other: string | null): string {
  if (surface === "other") return other?.trim() || "Other";
  return trialSurfaceOptions.find((o) => o.value === surface)?.label ?? surface;
}

// ---------------------------------------------------------------------------
// Validation (mirrors the database constraints; client-side friendliness only)
// ---------------------------------------------------------------------------

const UK_POSTCODE = /^(GIR ?0AA|[A-PR-UWYZ]([0-9]{1,2}|([A-HK-Y][0-9]([0-9ABEHMNPRV-Y])?)|[0-9][A-HJKPS-UW]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/i;
const UK_PHONE = /^(\+44|0)\d{9,10}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

const optionalTime = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || TIME.test(v), "Enter a valid time");

export const trialInviteSchema = z
  .object({
    trialDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a trial date")
      .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00`).getTime()), "Choose a valid date")
      .refine((d) => d >= todayIso(), "The trial date can't be in the past"),
    startTime: z.string().regex(TIME, "Enter a start time"),
    endTime: z.string().regex(TIME, "Enter an end time"),
    surface: z.enum(["grass", "3g", "4g", "astro", "other"]),
    surfaceOther: z.string().trim().max(60, "Keep this under 60 characters"),
    venueName: z.string().trim().min(1, "Enter the venue or ground name").max(120),
    streetAddress: z.string().trim().min(1, "Enter the street / road").max(200),
    postcode: z
      .string()
      .trim()
      .min(1, "Enter the postcode")
      .refine((v) => UK_POSTCODE.test(v.replace(/\s+/g, " ")), "Enter a valid UK postcode")
      .transform((v) => v.toUpperCase().replace(/\s+/g, " ")),
    arrivalTime: optionalTime,
    whatToBring: optionalText(500),
    kitInstructions: optionalText(500),
    changingInfo: optionalText(500),
    additionalInstructions: optionalText(1000),
    contactName: optionalText(80),
    contactPhone: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || UK_PHONE.test(v.replace(/[\s()-]/g, "")), "Enter a valid UK phone number"),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.startTime && v.endTime && v.startTime >= v.endTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start time" });
    }
    if (v.arrivalTime && v.startTime && v.arrivalTime > v.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["arrivalTime"],
        message: "Arrival time should be before the trial starts",
      });
    }
    if (v.surface === "other" && !v.surfaceOther) {
      ctx.addIssue({ code: "custom", path: ["surfaceOther"], message: "Describe the surface" });
    }
  });

export type TrialInviteFormInput = z.input<typeof trialInviteSchema>;
export type TrialInviteFormValues = z.output<typeof trialInviteSchema>;

export function emptyTrialInviteForm(): TrialInviteFormInput {
  return {
    trialDate: "",
    startTime: "",
    endTime: "",
    surface: "grass",
    surfaceOther: "",
    venueName: "",
    streetAddress: "",
    postcode: "",
    arrivalTime: "",
    whatToBring: "",
    kitInstructions: "",
    changingInfo: "",
    additionalInstructions: "",
    contactName: "",
    contactPhone: "",
    notes: "",
  };
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

export interface TrialInvite {
  id: string;
  applicationId: string | null;
  clubId: string;
  playerId: string;
  vacancyId: string | null;
  trialDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  surface: TrialSurface;
  surfaceOther: string | null;
  venueName: string;
  streetAddress: string;
  postcode: string;
  arrivalTime: string | null;
  whatToBring: string | null;
  kitInstructions: string | null;
  changingInfo: string | null;
  additionalInstructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  status: TrialInviteStatus;
  declineReason: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clubName: string;
  playerName: string;
  clubVerified: boolean;
  clubOwner: boolean;
  clubFounder: boolean;
  playerVerified: boolean;
  playerOwner: boolean;
  vacancyTitle: string | null;
  vacancyPositions: string[];
}

const inviteSelect = `id, application_id, club_id, player_id, vacancy_id, trial_date, start_time, end_time,
  surface, surface_other, venue_name, street_address, postcode, arrival_time, what_to_bring,
  kit_instructions, changing_info, additional_instructions, contact_name, contact_phone, notes,
  status, decline_reason, responded_at, created_at, updated_at,
  club:clubs!trial_invites_club_id_fkey ( name, is_founder_club, profile:profiles!clubs_id_fkey ( verification_status, is_owner ) ),
  player:players!trial_invites_player_id_fkey ( profile:profiles!players_id_fkey ( display_name, verification_status, is_owner ) ),
  vacancy:vacancies!trial_invites_vacancy_id_fkey ( title, positions )`;

type InviteRow = Database["public"]["Tables"]["trial_invites"]["Row"] & {
  club: { name: string; is_founder_club: boolean; profile: { verification_status: string; is_owner: boolean } | null } | null;
  player: { profile: { display_name: string; verification_status: string; is_owner: boolean } | null } | null;
  vacancy: { title: string | null; positions: string[] | null } | null;
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

function mapInvite(r: InviteRow): TrialInvite {
  return {
    id: r.id,
    applicationId: r.application_id,
    clubId: r.club_id,
    playerId: r.player_id,
    vacancyId: r.vacancy_id,
    trialDate: r.trial_date,
    startTime: hhmm(r.start_time)!,
    endTime: hhmm(r.end_time)!,
    surface: r.surface,
    surfaceOther: r.surface_other,
    venueName: r.venue_name,
    streetAddress: r.street_address,
    postcode: r.postcode,
    arrivalTime: hhmm(r.arrival_time),
    whatToBring: r.what_to_bring,
    kitInstructions: r.kit_instructions,
    changingInfo: r.changing_info,
    additionalInstructions: r.additional_instructions,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    notes: r.notes,
    status: r.status,
    declineReason: r.decline_reason,
    respondedAt: r.responded_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    clubName: r.club?.name ?? "Club",
    playerName: r.player?.profile?.display_name ?? "Player",
    clubVerified: r.club?.profile?.verification_status === "verified",
    clubOwner: Boolean(r.club?.profile?.is_owner),
    clubFounder: Boolean(r.club?.is_founder_club),
    playerVerified: r.player?.profile?.verification_status === "verified",
    playerOwner: Boolean(r.player?.profile?.is_owner),
    vacancyTitle: r.vacancy?.title ?? null,
    vacancyPositions: r.vacancy?.positions ?? [],
  };
}

async function authUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Local Date for the end (or start) of the trial. */
export function trialInstant(invite: Pick<TrialInvite, "trialDate" | "startTime" | "endTime">, which: "start" | "end" = "end") {
  return new Date(`${invite.trialDate}T${which === "end" ? invite.endTime : invite.startTime}:00`);
}

export function isTrialPast(invite: Pick<TrialInvite, "trialDate" | "startTime" | "endTime">, now = Date.now()) {
  return trialInstant(invite, "end").getTime() < now;
}

/**
 * A still-pending invitation whose trial start date/time has gone by is
 * "Passed": derived from the stored trial date/time, so it holds after refresh
 * and sign-in without any background job. The database also refuses
 * accept/decline once the start time has passed.
 */
export function isInvitePassed(invite: Pick<TrialInvite, "status" | "trialDate" | "startTime" | "endTime">, now = Date.now()) {
  return invite.status === "pending" && trialInstant(invite, "start").getTime() <= now;
}

/** Pending or accepted and not yet passed — counts as an active invitation. */
export function isInviteActive(invite: Pick<TrialInvite, "status" | "trialDate" | "startTime" | "endTime">, now = Date.now()) {
  return (invite.status === "pending" && !isInvitePassed(invite, now)) || invite.status === "accepted";
}

export type TrialDisplayStatus = "awaiting" | "accepted" | "declined" | "completed" | "cancelled" | "passed";

/** Status shown to users. Never changes the underlying application. */
export function trialDisplayStatus(invite: TrialInvite, now = Date.now()): TrialDisplayStatus {
  if (invite.status === "cancelled") return "cancelled";
  if (invite.status === "declined") return "declined";
  if (isInvitePassed(invite, now)) return "passed";
  if (isTrialPast(invite, now)) return "completed";
  return invite.status === "accepted" ? "accepted" : "awaiting";
}

export const trialStatusLabels: Record<TrialDisplayStatus, string> = {
  awaiting: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Trial completed",
  cancelled: "Cancelled",
  passed: "Passed",
};

export const trialStatusTone: Record<TrialDisplayStatus, string> = {
  awaiting: "border-primary/40 bg-primary/15 text-primary",
  accepted:
    "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
  completed: "border-border bg-elevated text-muted-foreground",
  cancelled: "border-border bg-elevated text-muted-foreground",
  passed: "border-border bg-elevated text-muted-foreground",
};

/** "Saturday 19 September" */
export function formatTrialDate(iso: string, opts: { short?: boolean } = {}): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: opts.short ? "short" : "long",
    day: "numeric",
    month: opts.short ? "short" : "long",
  });
}

/** "10:00 AM" */
export function formatTrialTime(hhmmStr: string): string {
  const [h, m] = hhmmStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

export function formatTrialTimeRange(invite: Pick<TrialInvite, "startTime" | "endTime">): string {
  return `${formatTrialTime(invite.startTime)} – ${formatTrialTime(invite.endTime)}`;
}

/** Sort: awaiting/upcoming → accepted → declined → past, date-ordered within each. */
export function sortTrialInvites(invites: TrialInvite[], now = Date.now()): TrialInvite[] {
  const rank: Record<TrialDisplayStatus, number> = {
    awaiting: 0,
    accepted: 1,
    declined: 2,
    cancelled: 3,
    completed: 4,
    passed: 4,
  };
  return [...invites].sort((a, b) => {
    const ra = rank[trialDisplayStatus(a, now)];
    const rb = rank[trialDisplayStatus(b, now)];
    if (ra !== rb) return ra - rb;
    const ta = trialInstant(a, "start").getTime();
    const tb = trialInstant(b, "start").getTime();
    // Upcoming: soonest first. Past/declined: most recent first.
    return ra >= 2 ? tb - ta : ta - tb;
  });
}

/** The invite worth surfacing for an application (active first, then latest). */
export function primaryInviteFor(invites: TrialInvite[], applicationId: string): TrialInvite | undefined {
  const mine = invites.filter((i) => i.applicationId === applicationId);
  if (!mine.length) return undefined;
  return (
    mine.find((i) => isInviteActive(i)) ??
    [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  );
}

// ---------------------------------------------------------------------------
// Player side
// ---------------------------------------------------------------------------

export async function fetchMyTrialInvites(): Promise<TrialInvite[]> {
  const uid = await authUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("trial_invites")
    .select(inviteSelect)
    .eq("player_id", uid)
    .order("trial_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as InviteRow[]).map(mapInvite);
}

export function useMyTrialInvites() {
  return useQuery({
    queryKey: ["my-trial-invites"],
    queryFn: fetchMyTrialInvites,
    staleTime: 10_000,
  });
}

/** One invite; RLS guarantees it belongs to the signed-in player or club. */
export async function fetchTrialInvite(id: string): Promise<TrialInvite | null> {
  const { data, error } = await supabase
    .from("trial_invites")
    .select(inviteSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapInvite(data as unknown as InviteRow) : null;
}

export function useTrialInvite(id: string | null) {
  return useQuery({
    queryKey: ["trial-invite", id],
    queryFn: () => fetchTrialInvite(id!),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["my-trial-invites"] });
  void qc.invalidateQueries({ queryKey: ["club-trial-invites"] });
  void qc.invalidateQueries({ queryKey: ["club-trial-entries"] });
  void qc.invalidateQueries({ queryKey: ["trial-invite"] });
  void qc.invalidateQueries({ queryKey: ["my-applications"] });
  void qc.invalidateQueries({ queryKey: ["club-applications"] });
  void qc.invalidateQueries({ queryKey: ["notifications"] });
}

/** Player accepts or declines THEIR OWN invitation. Never touches the application stage. */
export function useRespondToTrialInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      response,
      declineReason,
    }: {
      id: string;
      response: "accepted" | "declined";
      declineReason?: string;
    }) => {
      const uid = await authUserId();
      if (!uid) throw new Error("You need to be signed in as a player.");
      const reason = response === "declined" ? declineReason?.trim().slice(0, 500) || null : null;
      const { data, error } = await supabase
        .from("trial_invites")
        .update({ status: response, decline_reason: reason })
        .eq("id", id)
        .eq("player_id", uid)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("That trial invitation could not be updated.");
      return data.id;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

// ---------------------------------------------------------------------------
// Club side
// ---------------------------------------------------------------------------

export async function fetchClubTrialInvites(): Promise<TrialInvite[]> {
  const uid = await authUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("trial_invites")
    .select(inviteSelect)
    .eq("club_id", uid)
    .order("trial_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as InviteRow[]).map(mapInvite);
}

export function useClubTrialInvites() {
  return useQuery({
    queryKey: ["club-trial-invites"],
    queryFn: fetchClubTrialInvites,
    staleTime: 10_000,
  });
}

/**
 * Club sends a trial invitation for one of its applications. The database
 * derives club/player/vacancy from the application and rejects anything that
 * isn't the caller's own application, then moves the stage to "trial".
 */
export function useCreateTrialInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      playerId,
      values,
    }: {
      applicationId: string | null;
      playerId?: string | null;
      values: TrialInviteFormValues;
    }) => {
      if (!applicationId && !playerId) throw new Error("No player selected.");
      const uid = await authUserId();
      if (!uid) throw new Error("You need to be signed in as a club.");
      const { data, error } = await supabase
        .from("trial_invites")
        .insert({
          application_id: applicationId,
          // With an application these are overwritten by the BEFORE INSERT trigger.
          // Direct invites (no application) are validated by the same trigger.
          club_id: uid,
          player_id: applicationId ? uid : playerId!,
          vacancy_id: applicationId,
          trial_date: values.trialDate,
          start_time: values.startTime,
          end_time: values.endTime,
          surface: values.surface,
          surface_other: values.surface === "other" ? values.surfaceOther : null,
          venue_name: values.venueName,
          street_address: values.streetAddress,
          postcode: values.postcode,
          arrival_time: values.arrivalTime,
          what_to_bring: values.whatToBring,
          kit_instructions: values.kitInstructions,
          changing_info: values.changingInfo,
          additional_instructions: values.additionalInstructions,
          contact_name: values.contactName,
          contact_phone: values.contactPhone,
          notes: values.notes,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new Error("This player already has an active trial invitation from you.");
        }
        throw error;
      }
      return data.id;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Club cancels one of ITS OWN invitations. */
export function useCancelTrialInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await authUserId();
      if (!uid) throw new Error("You need to be signed in as a club.");
      const { data, error } = await supabase
        .from("trial_invites")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("club_id", uid)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("That trial invitation could not be cancelled.");
      return data.id;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
