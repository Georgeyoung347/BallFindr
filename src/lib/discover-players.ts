/**
 * Club-side discovery reads: real registered players.
 *
 * Tables read: profiles, players, levels. Everything runs as the signed-in
 * user through the existing RLS policies ("readable by authenticated users").
 * date_of_birth is never selected here — age stays private. No fabricated
 * match scores, distances or experience values.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DbAvailability, DbPosition } from "@/lib/player-profile";
import { resolveProfileImage } from "@/lib/profile-images";
import { fetchMyFootballSection } from "@/lib/football-section";
import { isPlayerCoreInfoComplete } from "@/lib/profile-completion";

export interface DiscoverPlayer {
  id: string;
  name: string;
  initials: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  location: string | null;
  currentClubName: string | null;
  levelId: number | null;
  levelName: string | null;
  preferredLevelId: number | null;
  preferredLevelName: string | null;
  primaryPosition: DbPosition | null;
  secondaryPositions: DbPosition[];
  availability: DbAvailability;
  openToTrials: boolean;
  bio: string | null;
  lookingFor: string | null;
  /** Safe calculated age from the player_cards view — date_of_birth is never read. */
  age: number | null;
  heightInches: number | null;
  isVerified: boolean;
  isOwner: boolean;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type PlayerRow = {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  location: string | null;
  current_club_name: string | null;
  level_id: number | null;
  level_name: string | null;
  preferred_level_id: number | null;
  preferred_level_name: string | null;
  primary_position: string | null;
  secondary_positions: string[] | null;
  availability: string;
  open_to_trials: boolean;
  bio: string | null;
  looking_for: string | null;
  height_inches: number | null;
  age: number | null;
  preferred_training_days: string[] | null;
};

export async function fetchDiscoverPlayers(): Promise<DiscoverPlayer[]> {
  // Men's / Women's separation is enforced by RLS; the filter below mirrors it.
  const mySection = await fetchMyFootballSection();
  // player_cards is the single controlled read path: it returns location, bio,
  // looking_for, training preferences and travel distance only to the player
  // themself, club accounts and admins, and never exposes date_of_birth.
  let playerQuery = supabase
    .from("player_cards")
    .select(
      `id, display_name, avatar_path, location, current_club_name, level_id, level_name,
         preferred_level_id, preferred_level_name, primary_position, secondary_positions,
         availability, open_to_trials, bio, looking_for, height_inches, age, preferred_training_days`,
    );
  if (mySection) playerQuery = playerQuery.eq("football_section", mySection);
  // Admin-hidden players are left out of discovery (not banned).
  playerQuery = playerQuery.eq("is_hidden", false);

  const [playerRes, profileRes] = await Promise.all([
    playerQuery.limit(500),
    supabase.from("profiles").select("id, verification_status, is_owner").eq("account_type", "player").limit(500),
  ]);

  if (playerRes.error) throw playerRes.error;
  if (profileRes.error) throw profileRes.error;
  const verifiedIds = new Set((profileRes.data ?? []).filter((p) => p.verification_status === "verified").map((p) => p.id));
  const ownerIds = new Set((profileRes.data ?? []).filter((p) => p.is_owner).map((p) => p.id));


  // Core Information completion is encouraged but does not affect discoverability.
  // Only accounts whose current account type is Player: a Player → Club switch keeps a
  // leftover players row, which must not appear in discovery.
  const playerAccountIds = new Set((profileRes.data ?? []).map((p) => p.id));
  const mapped = ((playerRes.data ?? []) as PlayerRow[])
    .filter((row) => playerAccountIds.has(row.id))
    .map((row) => {
      const name = row.display_name ?? "Player";
      const player: DiscoverPlayer = {
        id: row.id,
        name,
        initials: initialsOf(name),
        avatarPath: row.avatar_path,
        avatarUrl: null,
        location: row.location,
        currentClubName: row.current_club_name,
        levelId: row.level_id,
        levelName: row.level_name,
        preferredLevelId: row.preferred_level_id,
        preferredLevelName: row.preferred_level_name,
        primaryPosition: (row.primary_position as DbPosition | null) ?? null,
        secondaryPositions: (row.secondary_positions ?? []) as DbPosition[],
        availability: row.availability as DbAvailability,
        openToTrials: row.open_to_trials,
        bio: row.bio,
        lookingFor: row.looking_for,
        age: row.age,
        heightInches: row.height_inches,
        isVerified: verifiedIds.has(row.id),
        isOwner: ownerIds.has(row.id),
      };
      return player;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(mapped.map(async (player) => ({
    ...player,
    avatarUrl: await resolveProfileImage(player.avatarPath),
  })));
}

export function useDiscoverPlayers() {
  return useQuery({
    queryKey: ["discover-players"],
    queryFn: fetchDiscoverPlayers,
    staleTime: 30_000,
  });
}

export interface DiscoverLevel {
  id: number;
  name: string;
  rank: number;
}

export async function fetchLevels(): Promise<DiscoverLevel[]> {
  const { data, error } = await supabase
    .from("levels")
    .select("id, name, rank")
    .order("rank", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DiscoverLevel[];
}

export function useLevels() {
  return useQuery({ queryKey: ["levels"], queryFn: fetchLevels, staleTime: 300_000 });
}
