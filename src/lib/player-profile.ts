/**
 * Reads and writes the signed-in player's real record in Supabase and maps it
 * into the PlayerProfileRecord shape the profile UI already consumes.
 *
 * Tables read/written: profiles, players; levels is read-only reference data.
 * date_of_birth is only ever read/written for the authenticated player's own
 * row (RLS: auth.uid() = id) and is never exposed in public profile queries.
 * History and achievements come from player-cv.ts; media is not yet connected
 * and stays empty so the existing empty state renders.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Availability, TrainingDay } from "@/data/app-config";
import type { PlayerProfileRecord } from "@/data/profile-model";
import { fetchPlayerCv } from "@/lib/player-cv";
import { resolveProfileImage, updatePlayerImage, type PlayerImageSlot } from "@/lib/profile-images";

export const dbPositions = [
  "GK",
  "RB",
  "CB",
  "LB",
  "CDM",
  "CM",
  "CAM",
  "RW",
  "LW",
  "ST",
] as const;
export type DbPosition = (typeof dbPositions)[number];

export const dbAvailabilityOptions = [
  "actively_looking",
  "open_to_offers",
  "not_looking",
] as const;
export type DbAvailability = (typeof dbAvailabilityOptions)[number];

/** Sensible stored-height bounds, in total inches (4'0" – 7'6"). */
export const MIN_HEIGHT_INCHES = 48;
export const MAX_HEIGHT_INCHES = 90;

/** 73 -> `6'1"`. Returns undefined for missing/invalid values. */
export function formatHeight(inches: number | null | undefined): string | undefined {
  if (typeof inches !== "number" || !Number.isFinite(inches)) return undefined;
  const total = Math.round(inches);
  if (total < MIN_HEIGHT_INCHES || total > MAX_HEIGHT_INCHES) return undefined;
  return `${Math.floor(total / 12)}'${total % 12}"`;
}

export interface PlayerLevel {
  id: number;
  name: string;
}

/** Editable shape mapped 1:1 to profiles/players columns. */
export interface PlayerProfileForm {
  avatarPath: string | null;
  avatarUrl: string | null;
  coverPath: string | null;
  coverUrl: string | null;
  displayName: string;
  dateOfBirth: string;
  heightInches: number | null;
  location: string;
  currentClubName: string;
  levelId: number | null;
  preferredLevelId: number | null;
  primaryPosition: DbPosition | null;
  secondaryPositions: DbPosition[];
  availability: DbAvailability;
  preferredTrainingDays: TrainingDay[];
  maxTravelMiles: number | null;
  openToTrials: boolean;
  bio: string;
  lookingFor: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function ageFrom(dob: string | null | undefined): number | undefined {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : undefined;
}

// date_of_birth lives in the private player_private table; the owner reads it
// via the auth.uid()-bound my_player_private() function. Everything else is
// read through player_cards, which gates the recruitment detail fields.
const playerSelect = `id, height_inches, location, current_club_name, level_id, preferred_level_id,
   primary_position, secondary_positions, availability, preferred_training_days,
   max_travel_miles, open_to_trials, bio, looking_for, level_name, preferred_level_name`;

async function fetchOwnDateOfBirth(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_player_private");
  if (error) throw error;
  const row = (data as { date_of_birth: string | null }[] | null)?.[0];
  return row?.date_of_birth ?? null;
}

export async function fetchSignedInPlayerProfile(): Promise<PlayerProfileRecord | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, playerRes, cv, dateOfBirth] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_path, cover_path, verification_status, is_owner")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("player_cards").select(playerSelect).eq("id", user.id).maybeSingle(),
    fetchPlayerCv(user.id),
    fetchOwnDateOfBirth(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (playerRes.error) throw playerRes.error;

  const profile = profileRes.data;
  const player = playerRes.data;
  if (!profile) return null;

  const fullName = profile.display_name;
  const [photoUrl, coverUrl] = await Promise.all([
    resolveProfileImage(profile.avatar_path),
    resolveProfileImage(profile.cover_path),
  ]);
  const level = player?.level_name ?? undefined;
  const preferredLevel = player?.preferred_level_name ?? undefined;
  const secondary = (player?.secondary_positions ?? []) as string[];
  const availability = (player?.availability ?? "open_to_offers") as Availability;
  const age = ageFrom(dateOfBirth);

  return {
    id: profile.id,
    fullName,
    isVerified: profile.verification_status === "verified",
    isOwner: profile.is_owner,
    initials: initialsOf(fullName),
    ...(profile.avatar_path ? { photoPath: profile.avatar_path } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    ...(profile.cover_path ? { coverPath: profile.cover_path } : {}),
    ...(coverUrl ? { coverUrl } : {}),
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
    history: cv.history,
    achievements: cv.achievements,
    
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

export function useSignedInPlayerProfile() {
  return useQuery({
    queryKey: ["signed-in-player-profile"],
    queryFn: fetchSignedInPlayerProfile,
    staleTime: 30_000,
  });
}

export interface PlayerProfileExtras {
  historyCount: number;
  achievementsCount: number;
  /** Photos + clips in the player's media gallery (strength credits ≥ 1 once). */
  mediaCount: number;
}

/** Row counts for the signed-in player's history/achievements/media (strength calc). */
export async function fetchPlayerProfileExtras(): Promise<PlayerProfileExtras> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { historyCount: 0, achievementsCount: 0, mediaCount: 0 };

  const [historyRes, achievementsRes, mediaRes] = await Promise.all([
    supabase
      .from("player_history")
      .select("id", { count: "exact", head: true })
      .eq("player_id", user.id),
    supabase
      .from("achievements")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("owner_profile_id", user.id)
      .eq("bucket", "player-media")
      .in("kind", ["photo", "video"]),
  ]);
  if (historyRes.error) throw historyRes.error;
  if (achievementsRes.error) throw achievementsRes.error;
  if (mediaRes.error) throw mediaRes.error;

  return {
    historyCount: historyRes.count ?? 0,
    achievementsCount: achievementsRes.count ?? 0,
    mediaCount: mediaRes.count ?? 0,
  };
}

export function usePlayerProfileExtras() {
  return useQuery({
    queryKey: ["signed-in-player-extras"],
    queryFn: fetchPlayerProfileExtras,
    staleTime: 30_000,
  });
}

export async function fetchPlayerLevels(): Promise<PlayerLevel[]> {
  const { data, error } = await supabase.from("levels").select("id, name").order("rank");
  if (error) throw error;
  return data ?? [];
}

export function usePlayerLevels() {
  return useQuery({ queryKey: ["levels"], queryFn: fetchPlayerLevels, staleTime: 60 * 60_000 });
}

/** Raw editable values for the signed-in player, straight from their own rows. */
export async function fetchSignedInPlayerForm(): Promise<PlayerProfileForm | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, playerRes, dateOfBirth] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_path, cover_path").eq("id", user.id).maybeSingle(),
    supabase.from("player_cards").select(playerSelect).eq("id", user.id).maybeSingle(),
    fetchOwnDateOfBirth(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (playerRes.error) throw playerRes.error;

  const p = playerRes.data;
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveProfileImage(profileRes.data?.avatar_path),
    resolveProfileImage(profileRes.data?.cover_path),
  ]);
  return {
    avatarPath: profileRes.data?.avatar_path ?? null,
    avatarUrl,
    coverPath: profileRes.data?.cover_path ?? null,
    coverUrl,
    displayName: profileRes.data?.display_name ?? "",
    dateOfBirth: dateOfBirth ?? "",
    heightInches: p?.height_inches ?? null,
    location: p?.location ?? "",
    currentClubName: p?.current_club_name ?? "",
    levelId: p?.level_id ?? null,
    preferredLevelId: p?.preferred_level_id ?? null,
    primaryPosition: (p?.primary_position as DbPosition | null) ?? null,
    secondaryPositions: ((p?.secondary_positions ?? []) as DbPosition[]).filter(Boolean),
    availability: (p?.availability as DbAvailability | undefined) ?? "open_to_offers",
    preferredTrainingDays: ((p?.preferred_training_days ?? []) as TrainingDay[]).filter(Boolean),
    maxTravelMiles: p?.max_travel_miles ?? null,
    openToTrials: p?.open_to_trials ?? true,
    bio: p?.bio ?? "",
    lookingFor: p?.looking_for ?? "",
  };
}

export async function savePlayerImage(slot: PlayerImageSlot, file: File | null, oldPath: string | null) {
  return updatePlayerImage(slot, file, oldPath);
}

export function useSignedInPlayerForm(enabled = true) {
  return useQuery({
    queryKey: ["signed-in-player-form"],
    queryFn: fetchSignedInPlayerForm,
    enabled,
    staleTime: 0,
  });
}

export async function saveSignedInPlayerProfile(form: PlayerProfileForm) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("You need to be signed in to update your profile.");

  const profileUpdate = await supabase
    .from("profiles")
    .update({ display_name: form.displayName.trim() })
    .eq("id", user.id);
  if (profileUpdate.error) throw profileUpdate.error;

  const playerUpdate = await supabase
    .from("players")
    .update({
      height_inches: form.heightInches,
      location: form.location.trim() || null,
      current_club_name: form.currentClubName.trim() || null,
      level_id: form.levelId,
      preferred_level_id: form.preferredLevelId,
      primary_position: form.primaryPosition,
      secondary_positions: form.secondaryPositions,
      availability: form.availability,
      preferred_training_days: form.preferredTrainingDays,
      max_travel_miles: form.maxTravelMiles,
      open_to_trials: form.openToTrials,
      bio: form.bio.trim() || null,
      looking_for: form.lookingFor.trim() || null,
    })
    .eq("id", user.id);
  if (playerUpdate.error) throw playerUpdate.error;

  // Date of birth lives in the private table only the player (and admins) can read.
  const privateUpdate = await supabase
    .from("player_private")
    .upsert(
      { player_id: user.id, date_of_birth: form.dateOfBirth ? form.dateOfBirth : null },
      { onConflict: "player_id" },
    );
  if (privateUpdate.error) throw privateUpdate.error;
}

export function useSavePlayerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSignedInPlayerProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["signed-in-player-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["signed-in-player-form"] });
    },
  });
}
