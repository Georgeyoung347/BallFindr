/**
 * Real player "saved" state backed by the existing public.saved_clubs and
 * public.saved_vacancies tables.
 *
 * Security: every read and write filters by the signed-in user's own id and
 * relies on the existing RLS ("Players manage their saved clubs/vacancies"
 * with auth.uid() = player_id). No service role, no schema changes.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingDay } from "@/data/app-config";
import type { DbPosition } from "@/lib/player-profile";
import { resolveProfileImage } from "@/lib/profile-images";
import { positionLabels, vacancyTitleFor } from "@/lib/club-vacancies";

const DUPLICATE = "23505";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* ------------------------------------------------------------------ ids */

async function fetchSavedClubIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("saved_clubs")
    .select("club_id")
    .eq("player_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.club_id);
}

async function fetchSavedVacancyIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("saved_vacancies")
    .select("vacancy_id")
    .eq("player_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.vacancy_id);
}

export function useSavedClubIds() {
  return useQuery({
    queryKey: ["saved", "clubs", "ids"],
    queryFn: fetchSavedClubIds,
    staleTime: 30_000,
  });
}

export function useSavedVacancyIds() {
  return useQuery({
    queryKey: ["saved", "vacancies", "ids"],
    queryFn: fetchSavedVacancyIds,
    staleTime: 30_000,
  });
}

/* -------------------------------------------------------------- toggles */

async function toggleSavedClub({ clubId, saved }: { clubId: string; saved: boolean }) {
  const userId = await currentUserId();
  if (!userId) return;
  if (saved) {
    const { error } = await supabase
      .from("saved_clubs")
      .delete()
      .eq("player_id", userId)
      .eq("club_id", clubId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("saved_clubs")
    .insert({ player_id: userId, club_id: clubId });
  // The (player_id, club_id) unique constraint already has it — not an error.
  if (error && error.code !== DUPLICATE) throw error;
}

async function toggleSavedVacancy({ vacancyId, saved }: { vacancyId: string; saved: boolean }) {
  const userId = await currentUserId();
  if (!userId) return;
  if (saved) {
    const { error } = await supabase
      .from("saved_vacancies")
      .delete()
      .eq("player_id", userId)
      .eq("vacancy_id", vacancyId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("saved_vacancies")
    .insert({ player_id: userId, vacancy_id: vacancyId });
  if (error && error.code !== DUPLICATE) throw error;
}

export function useToggleSavedClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleSavedClub,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["saved"] }),
  });
}

export function useToggleSavedVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleSavedVacancy,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["saved"] }),
  });
}

/* ---------------------------------------------------------- saved lists */

export interface SavedClubItem {
  id: string;
  name: string;
  short: string;
  badgeUrl: string | null;
  location: string | null;
  league: string | null;
  levelName: string | null;
  isVerified: boolean;
  isOwner: boolean;
  isFounderClub: boolean;
}

export interface SavedVacancyItem {
  id: string;
  clubId: string;
  clubName: string;
  positions: DbPosition[];
  positionLabel: string | null;
  title: string | null;
  location: string | null;
  levelName: string | null;
  createdAt: string;
  status: string;
  clubVerified: boolean;
  clubOwner: boolean;
  clubFounder: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "FC";
  return parts
    .slice(0, 3)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type SavedClubRow = {
  club: {
    id: string;
    name: string;
    short_name: string | null;
    badge_path: string | null;
    location: string | null;
    league: string | null;
    level: { name: string } | null;
    is_founder_club: boolean;
    profile: { verification_status: string; is_owner: boolean } | null;
  } | null;
};

type SavedVacancyRow = {
  vacancy: {
    id: string;
    club_id: string;
    positions: string[] | null;
    title: string | null;
    location: string | null;
    created_at: string;
    status: string;
    club: { name: string; is_founder_club: boolean; profile: { verification_status: string; is_owner: boolean } | null } | null;
    level: { name: string } | null;
  } | null;
};

async function fetchSavedClubs(): Promise<SavedClubItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("saved_clubs")
    .select(
      `club:clubs!saved_clubs_club_id_fkey (
          id, name, short_name, badge_path, location, league, is_founder_club,
         profile:profiles!clubs_id_fkey ( verification_status, is_owner ),
         level:levels!clubs_level_id_fkey ( name )
       )`,
    )
    .eq("player_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const clubs = ((data ?? []) as unknown as SavedClubRow[])
    .map((r) => r.club)
    .filter((c): c is NonNullable<SavedClubRow["club"]> => Boolean(c))
  return Promise.all(clubs.map(async (c) => ({
      id: c.id,
      name: c.name,
      short: c.short_name?.trim() || initials(c.name),
      badgeUrl: await resolveProfileImage(c.badge_path),
      location: c.location,
      league: c.league,
      levelName: c.level?.name ?? null,
      isVerified: c.profile?.verification_status === "verified",
      isOwner: Boolean(c.profile?.is_owner),
      isFounderClub: c.is_founder_club,
    })));
}

async function fetchSavedVacancies(): Promise<SavedVacancyItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("saved_vacancies")
    .select(
      `vacancy:vacancies!saved_vacancies_vacancy_id_fkey (
         id, club_id, positions, title, location, created_at, status,
         club:clubs!vacancies_club_id_fkey ( name, is_founder_club, profile:profiles!clubs_id_fkey ( verification_status, is_owner ) ),
         level:levels!vacancies_level_id_fkey ( name )
       )`,
    )
    .eq("player_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as SavedVacancyRow[])
    .map((r) => r.vacancy)
    .filter((v): v is NonNullable<SavedVacancyRow["vacancy"]> => Boolean(v))
    .map((v) => {
      const positions = (v.positions ?? []) as DbPosition[];
      const first = positions[0];
      return {
        id: v.id,
        clubId: v.club_id,
        clubName: v.club?.name ?? "Club",
        positions,
        positionLabel: vacancyTitleFor(positions),
        title: v.title,
        location: v.location,
        levelName: v.level?.name ?? null,
        createdAt: v.created_at,
        status: v.status,
        clubVerified: v.club?.profile?.verification_status === "verified",
        clubOwner: Boolean(v.club?.profile?.is_owner),
        clubFounder: Boolean(v.club?.is_founder_club),
      };
    });
}

export function useSavedClubs() {
  return useQuery({
    queryKey: ["saved", "clubs", "list"],
    queryFn: fetchSavedClubs,
    staleTime: 15_000,
  });
}

export function useSavedVacancies() {
  return useQuery({
    queryKey: ["saved", "vacancies", "list"],
    queryFn: fetchSavedVacancies,
    staleTime: 15_000,
  });
}
