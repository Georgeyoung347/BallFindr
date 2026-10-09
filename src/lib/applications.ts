/**
 * Real player ↔ club application flow backed by Supabase.
 *
 * Tables read/written: applications (player + club both read the SAME row),
 * with joins into vacancies, clubs, players, profiles and levels for display.
 * application_events and notifications are written by database triggers on
 * insert / stage change — nothing here writes to them directly.
 *
 * Security relies entirely on the existing RLS:
 *  - players may only INSERT rows where player_id = auth.uid()
 *  - only the involved player or club may SELECT / UPDATE a row
 *  - club_id is forced from the vacancy by a BEFORE trigger
 * Every mutation here also filters by the caller's own id so a request can
 * never target somebody else's application even before RLS is applied.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Availability, TrainingDay } from "@/data/app-config";
import type { PlayerProfileRecord } from "@/data/profile-model";
import { positionLabels, vacancyTitleFor } from "@/lib/club-vacancies";
import type { DbPosition } from "@/lib/player-profile";
import { fetchPlayerCv } from "@/lib/player-cv";
import { resolveProfileImage } from "@/lib/profile-images";

/** The single source of truth for stages — mirrors the application_stage enum. */
export const applicationStages = [
  "interested",
  "reviewing",
  "shortlisted",
  "contacted",
  "trial",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStage = (typeof applicationStages)[number];

export const applicationStageLabels: Record<ApplicationStage, string> = {
  interested: "Interest sent",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  // `contacted` still exists in the database enum but is no longer used or
  // offered anywhere in the frontend; it falls back to the shortlisted wording.
  contacted: "Shortlisted",
  trial: "Trial invited",
  accepted: "Accepted",
  rejected: "Not progressed",
  withdrawn: "Withdrawn",
};

/** The forward path shown on the player's progress bar. */
export const applicationProgressStages: ApplicationStage[] = [
  "interested",
  "reviewing",
  "shortlisted",
  "trial",
  "accepted",
];

/** Stages a club can move an application to. */
export const clubStageOptions: ApplicationStage[] = [
  "reviewing",
  "shortlisted",
  "trial",
  "accepted",
  "rejected",
];

export const applicationStageTone: Record<ApplicationStage, string> = {
  interested: "border-border bg-elevated text-muted-foreground",
  reviewing: "border-border bg-elevated text-foreground",
  shortlisted: "border-primary/30 bg-primary/10 text-primary",
  contacted: "border-primary/30 bg-primary/10 text-primary",
  trial: "border-primary/40 bg-primary/15 text-primary",
  accepted:
    "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  withdrawn: "border-border bg-elevated text-muted-foreground",
};

export function appliedAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

async function authUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Player side
// ---------------------------------------------------------------------------

export interface PlayerApplication {
  id: string;
  vacancyId: string;
  clubId: string;
  stage: ApplicationStage;
  createdAt: string;
  updatedAt: string;
  clubName: string;
  clubShort: string;
  clubBadgeUrl: string | null;
  vacancyTitle: string | null;
  positionLabel: string | null;
  levelName: string | null;
  vacancyStatus: string;
  clubVerified: boolean;
  clubOwner: boolean;
  clubFounder: boolean;
}

interface PlayerAppRow {
  id: string;
  vacancy_id: string;
  club_id: string;
  stage: ApplicationStage;
  created_at: string;
  updated_at: string;
  club: { id: string; name: string; short_name: string | null; badge_path: string | null; is_founder_club: boolean; profile: { verification_status: string; is_owner: boolean } | null } | null;
  vacancy: {
    title: string | null;
    positions: string[] | null;
    status: string;
    level: { name: string } | null;
  } | null;
}

const playerAppSelect = `id, vacancy_id, club_id, stage, created_at, updated_at,
  club:clubs!applications_club_id_fkey ( id, name, short_name, badge_path, is_founder_club, profile:profiles!clubs_id_fkey ( verification_status, is_owner ) ),
  vacancy:vacancies!applications_vacancy_id_fkey ( title, positions, status, level:levels ( name ) )`;

export async function fetchMyApplications(): Promise<PlayerApplication[]> {
  const uid = await authUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("applications")
    .select(playerAppSelect)
    .eq("player_id", uid)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Promise.all(((data ?? []) as unknown as PlayerAppRow[]).map(async (r) => {
    const first = (r.vacancy?.positions ?? [])[0] as DbPosition | undefined;
    const clubName = r.club?.name ?? "Club";
    return {
      id: r.id,
      vacancyId: r.vacancy_id,
      clubId: r.club_id,
      stage: r.stage,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      clubName,
      clubShort: r.club?.short_name?.trim() || initialsOf(clubName),
      clubBadgeUrl: await resolveProfileImage(r.club?.badge_path),
      vacancyTitle: r.vacancy?.title ?? null,
      positionLabel: vacancyTitleFor((r.vacancy?.positions ?? []) as DbPosition[]),
      levelName: r.vacancy?.level?.name ?? null,
      vacancyStatus: r.vacancy?.status ?? "active",
      clubVerified: r.club?.profile?.verification_status === "verified",
      clubOwner: Boolean(r.club?.profile?.is_owner),
      clubFounder: Boolean(r.club?.is_founder_club),
    };
  }));
}

export function useMyApplications() {
  return useQuery({
    queryKey: ["my-applications"],
    queryFn: fetchMyApplications,
    staleTime: 10_000,
  });
}

/** Player expresses interest in a vacancy. Never creates a duplicate. */
export function useApplyToVacancy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vacancyId, clubId }: { vacancyId: string; clubId: string }) => {
      const uid = await authUserId();
      if (!uid) throw new Error("You need to be signed in as a player to register interest.");

      const existing = await supabase
        .from("applications")
        .select("id, stage")
        .eq("player_id", uid)
        .eq("vacancy_id", vacancyId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      const withdrawnId = existing.data?.stage === "withdrawn" ? existing.data.id : null;
      if (existing.data && !withdrawnId) return { id: existing.data.id, created: false as const };

      // A closed / filled / expired vacancy can never take a new application.
      const vacancy = await supabase
        .from("vacancies")
        .select("status, expires_at")
        .eq("id", vacancyId)
        .maybeSingle();
      if (vacancy.error) throw vacancy.error;
      const expired = Boolean(
        vacancy.data?.expires_at && new Date(vacancy.data.expires_at).getTime() <= Date.now(),
      );
      if (!vacancy.data || vacancy.data.status !== "active" || expired) {
        throw new Error("This opportunity is closed and is no longer accepting applications.");
      }

      // Re-applying after a withdrawal reuses the same application record.
      if (withdrawnId) {
        const { error } = await supabase
          .from("applications")
          .update({ stage: "interested" })
          .eq("id", withdrawnId)
          .eq("player_id", uid);
        if (error) throw error;
        return { id: withdrawnId, created: true as const };
      }

      // player_id must equal auth.uid() (RLS); club_id is re-derived from the
      // vacancy by the enforce_application_club trigger.
      const { data, error } = await supabase
        .from("applications")
        .insert({ player_id: uid, vacancy_id: vacancyId, club_id: clubId, stage: "interested" })
        .select("id")
        .single();
      if (error) {
        // unique violation → someone double-clicked; treat as already applied
        if (error.code === "23505") return { id: null, created: false as const };
        throw error;
      }
      return { id: data.id, created: true as const };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

/** Stages a player can still withdraw from. */
export function canWithdrawApplication(stage: ApplicationStage): boolean {
  return stage !== "withdrawn" && stage !== "rejected" && stage !== "accepted";
}

/**
 * Player withdraws their own interest. Keeps the application record (stage →
 * withdrawn) so history is preserved; trial invites are left untouched.
 */
export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const uid = await authUserId();
      if (!uid) throw new Error("You need to be signed in as a player.");
      const { error } = await supabase
        .from("applications")
        .update({ stage: "withdrawn" })
        .eq("id", id)
        .eq("player_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Club side
// ---------------------------------------------------------------------------

export interface ClubApplicant {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  primaryPosition: string | null;
  levelName: string | null;
  location: string | null;
  availability: Availability;
  isVerified: boolean;
  isOwner: boolean;
}

export interface ClubApplication {
  id: string;
  playerId: string;
  vacancyId: string;
  stage: ApplicationStage;
  createdAt: string;
  updatedAt: string;
  player: ClubApplicant;
  vacancyTitle: string | null;
  positionLabel: string | null;
  vacancyStatus: string;
}

interface ClubAppRow {
  id: string;
  player_id: string;
  vacancy_id: string;
  stage: ApplicationStage;
  created_at: string;
  updated_at: string;
  player: {
    primary_position: string | null;
    availability: Availability;
    level: { name: string } | null;
    profile: { display_name: string; avatar_path: string | null; verification_status: string; is_owner: boolean } | null;
  } | null;
  vacancy: { title: string | null; positions: string[] | null; status: string } | null;
}

const clubAppSelect = `id, player_id, vacancy_id, stage, created_at, updated_at,
  player:players!applications_player_id_fkey ( primary_position, availability,
    level:levels!players_level_id_fkey ( name ),
     profile:profiles!players_id_fkey ( display_name, avatar_path, verification_status, is_owner ) ),
  vacancy:vacancies!applications_vacancy_id_fkey ( title, positions, status )`;

async function mapClubApp(r: ClubAppRow): Promise<ClubApplication> {
  const first = (r.vacancy?.positions ?? [])[0] as DbPosition | undefined;
  const name = r.player?.profile?.display_name ?? "Player";
  const pos = r.player?.primary_position as DbPosition | null | undefined;
  // Location is not a directly readable column; it comes from the gated player_details() read.
  const [photoUrl, details] = await Promise.all([
    resolveProfileImage(r.player?.profile?.avatar_path),
    supabase.rpc("player_details", { _player_id: r.player_id }),
  ]);
  return {
    id: r.id,
    playerId: r.player_id,
    vacancyId: r.vacancy_id,
    stage: r.stage,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    player: {
      id: r.player_id,
      name,
      initials: initialsOf(name),
      photoUrl,
      primaryPosition: pos ? (positionLabels[pos] ?? pos) : null,
      levelName: r.player?.level?.name ?? null,
      location: details.data?.[0]?.location ?? null,
      availability: r.player?.availability ?? "open_to_offers",
      isVerified: r.player?.profile?.verification_status === "verified",
      isOwner: Boolean(r.player?.profile?.is_owner),
    },
    vacancyTitle: r.vacancy?.title ?? null,
    positionLabel: vacancyTitleFor((r.vacancy?.positions ?? []) as DbPosition[]),
    vacancyStatus: r.vacancy?.status ?? "active",
  };
}

export async function fetchClubApplications(): Promise<ClubApplication[]> {
  const uid = await authUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("applications")
    .select(clubAppSelect)
    .eq("club_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(((data ?? []) as unknown as ClubAppRow[]).map(mapClubApp));
}

export function useClubApplications() {
  return useQuery({
    queryKey: ["club-applications"],
    queryFn: fetchClubApplications,
    staleTime: 10_000,
  });
}

/** Club moves one of ITS OWN applications to a new stage. */
export function useSetApplicationStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: ApplicationStage }) => {
      const uid = await authUserId();
      if (!uid) throw new Error("You need to be signed in as a club.");
      const { data, error } = await supabase
        .from("applications")
        .update({ stage })
        .eq("id", id)
        .eq("club_id", uid)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("That application could not be updated.");
      return data.id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club-applications"] });
      void queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Applicant profile as seen by a club (no date_of_birth is ever selected)
// ---------------------------------------------------------------------------

// player_cards is the controlled read path: recruitment detail (location, bio,
// looking_for, training preferences, travel distance) is returned only to the
// player themself, club accounts and admins. date_of_birth is never readable.
const publicPlayerSelect = `id, height_inches, location, current_club_name, primary_position, secondary_positions,
   availability, preferred_training_days, max_travel_miles, open_to_trials, bio, looking_for,
   level_name, preferred_level_name, age`;

export async function fetchPublicPlayerProfile(
  playerId: string,
): Promise<PlayerProfileRecord | null> {
  const [profileRes, playerRes, cv] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, cover_path, verification_status, is_owner").eq("id", playerId).maybeSingle(),
    supabase.from("player_cards").select(publicPlayerSelect).eq("id", playerId).maybeSingle(),
    fetchPlayerCv(playerId),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (playerRes.error) throw playerRes.error;
  const profile = profileRes.data;
  const player = playerRes.data;
  if (!profile) return null;

  const level = player?.level_name ?? undefined;
  const preferredLevel = player?.preferred_level_name ?? undefined;
  const secondary = (player?.secondary_positions ?? []) as string[];
  const availability = (player?.availability ?? "open_to_offers") as Availability;
  const [photoUrl, coverUrl] = await Promise.all([
    resolveProfileImage(profile.avatar_path),
    resolveProfileImage(profile.cover_path),
  ]);
  const age = typeof player?.age === "number" ? player.age : undefined;

  const { history, achievements } = cv;

  return {
    id: profile.id,
    fullName: profile.display_name,
    isVerified: profile.verification_status === "verified",
    isOwner: profile.is_owner,
    initials: initialsOf(profile.display_name),
    ...(photoUrl ? { photoUrl } : {}),
    ...(profile.avatar_path ? { photoPath: profile.avatar_path } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(profile.cover_path ? { coverPath: profile.cover_path } : {}),
    ...(age !== undefined ? { age } : {}),
    ...(typeof player?.height_inches === "number" ? { heightInches: player.height_inches } : {}),
    ...(player?.location ? { location: player.location } : {}),
    ...(player?.current_club_name ? { currentClub: player.current_club_name } : {}),
    ...(level ? { currentLevel: level } : {}),
    ...(player?.primary_position ? { primaryPosition: player.primary_position } : {}),
    secondaryPositions: secondary,
    ...(preferredLevel ? { preferredLevel } : {}),
    availability,
    preferredTrainingDays: ((player?.preferred_training_days ?? []) as string[]) as TrainingDay[],
    ...(player?.bio ? { bio: player.bio } : {}),
    history,
    achievements,
    
    recruitment: {
      lookingFor: player?.looking_for ?? "",
      preferredLevels: preferredLevel ? [preferredLevel] : [],
      preferredPositions: [player?.primary_position, ...secondary].filter(Boolean) as string[],
      maxTravelMiles: player?.max_travel_miles ?? 0,
      availability,
      openToTrials: player?.open_to_trials ?? false,
    },
  };
}


export function usePublicPlayerProfile(playerId: string, enabled = true) {
  return useQuery({
    queryKey: ["public-player-profile", playerId],
    queryFn: () => fetchPublicPlayerProfile(playerId),
    enabled,
    staleTime: 30_000,
  });
}

/** Is this id a real Supabase uuid (vs. a demo id such as p_jack)? */
export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
