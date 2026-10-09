/**
 * Club-side "saved players" backed by the existing public.saved_players table.
 *
 * Security: every read and write filters by the signed-in club's own id and
 * relies on the existing RLS ("Clubs manage their saved players" with
 * auth.uid() = club_id). No service role, no schema changes.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DbAvailability, DbPosition } from "@/lib/player-profile";
import { resolveProfileImage } from "@/lib/profile-images";

const DUPLICATE = "23505";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchSavedPlayerIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("saved_players")
    .select("player_id")
    .eq("club_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.player_id);
}

export function useSavedPlayerIds() {
  return useQuery({
    queryKey: ["saved-players", "ids"],
    queryFn: fetchSavedPlayerIds,
    staleTime: 30_000,
  });
}

async function toggleSavedPlayer({ playerId, saved }: { playerId: string; saved: boolean }) {
  const userId = await currentUserId();
  if (!userId) return;
  if (saved) {
    const { error } = await supabase
      .from("saved_players")
      .delete()
      .eq("club_id", userId)
      .eq("player_id", playerId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("saved_players")
    .insert({ club_id: userId, player_id: playerId });
  // Already saved — the unique constraint makes this a no-op, not an error.
  if (error && error.code !== DUPLICATE) throw error;
}

export function useToggleSavedPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleSavedPlayer,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["saved-players"] }),
  });
}

/* ---------------------------------------------------------- saved list */

export interface SavedPlayerItem {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  /** Safe calculated age from the player_cards view — never a date of birth. */
  age: number | null;
  location: string | null;
  currentClubName: string | null;
  levelName: string | null;
  primaryPosition: DbPosition | null;
  secondaryPositions: DbPosition[];
  availability: DbAvailability;
  openToTrials: boolean;
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

type CardRow = {
  id: string;
  location: string | null;
  current_club_name: string | null;
  primary_position: string | null;
  secondary_positions: string[] | null;
  availability: string;
  open_to_trials: boolean;
  level_name: string | null;
  age: number | null;
};

async function fetchSavedPlayers(): Promise<SavedPlayerItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("saved_players")
    .select("player_id")
    .eq("club_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = ((data ?? []) as { player_id: string }[]).map((r) => r.player_id);
  if (!ids.length) return [];

  const [profileRes, cardRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, verification_status, is_owner").in("id", ids),
    // player_cards is the controlled read path; date_of_birth is never read.
    supabase
      .from("player_cards")
      .select(
        "id, location, current_club_name, primary_position, secondary_positions, availability, open_to_trials, level_name, age",
      )
      .in("id", ids),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (cardRes.error) throw cardRes.error;
  const profiles = new Map((profileRes.data ?? []).map((p) => [p.id, p]));
  const cards = new Map(
    ((cardRes.data ?? []) as unknown as CardRow[]).map((c) => [c.id, c] as const),
  );

  return Promise.all(ids.map(async (playerId) => {
    const p = cards.get(playerId);
    const profile = profiles.get(playerId);
    const name = profile?.display_name ?? "Player";
    const avatar = profile?.avatar_path ?? null;
    return {
      id: playerId,
      name,
      initials: initialsOf(name),
      photoUrl: await resolveProfileImage(avatar),
      age: p?.age ?? null,
      location: p?.location ?? null,
      currentClubName: p?.current_club_name ?? null,
      levelName: p?.level_name ?? null,
      primaryPosition: (p?.primary_position as DbPosition | null) ?? null,
      secondaryPositions: (p?.secondary_positions ?? []) as DbPosition[],
      availability: (p?.availability ?? "open_to_offers") as DbAvailability,
      openToTrials: p?.open_to_trials ?? false,
      isVerified: profile?.verification_status === "verified",
      isOwner: Boolean(profile?.is_owner),
    };
  }));
}

export function useSavedPlayers() {
  return useQuery({
    queryKey: ["saved-players", "list"],
    queryFn: fetchSavedPlayers,
    staleTime: 15_000,
  });
}
