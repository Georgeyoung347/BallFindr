/**
 * Player football CV: playing history (player_history) and achievements
 * (achievements) for the signed-in player.
 *
 * All writes go through the authenticated browser client and are additionally
 * scoped to the signed-in user's id, so RLS (auth.uid() = player_id /
 * profile_id) is the enforcing boundary — a player can never touch another
 * player's rows. Reads for public profiles live in applications.ts and reuse
 * the row mappers exported here.
 *
 * Years: player_history stores `season_start` (start year) and a free-text
 * `season` label. We derive the label from a start year and an optional end
 * year ("2022 – Present" when ongoing, "2022/23" for a single season,
 * "2020 – 2023" for a longer spell) and parse it back for editing.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  achievementKindLabels,
  type Achievement,
  type AchievementKind,
  type PlayerHistoryEntry,
} from "@/data/profile-model";
import type { DbPosition } from "@/lib/player-profile";

export const achievementKinds = Object.keys(achievementKindLabels) as AchievementKind[];

export const CURRENT_LABEL = "Present";
export const MIN_HISTORY_YEAR = 1950;

export function currentYear(): number {
  return new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// Season label helpers
// ---------------------------------------------------------------------------

export function seasonLabel(startYear: number, endYear: number | null): string {
  if (endYear === null) return `${startYear} – ${CURRENT_LABEL}`;
  if (endYear === startYear) return `${startYear}`;
  if (endYear === startYear + 1) return `${startYear}/${String(endYear % 100).padStart(2, "0")}`;
  return `${startYear} – ${endYear}`;
}

/** Parses a stored season label back into years; falls back to season_start. */
export function parseSeason(
  season: string,
  seasonStart: number,
): { startYear: number; endYear: number | null; isCurrent: boolean } {
  const s = season.trim();
  const range = s.match(/^(\d{4})\s*[–-]\s*(Present|present|Current|current|\d{4})$/);
  if (range) {
    const start = Number(range[1]);
    const endRaw = range[2]!;
    const isCurrent = /^(present|current)$/i.test(endRaw);
    return { startYear: start, endYear: isCurrent ? null : Number(endRaw), isCurrent };
  }
  const single = s.match(/^(\d{4})\/(\d{2,4})$/);
  if (single) {
    const start = Number(single[1]);
    return { startYear: start, endYear: start + 1, isCurrent: false };
  }
  const year = s.match(/^(\d{4})$/);
  if (year) {
    const start = Number(year[1]);
    return { startYear: start, endYear: start, isCurrent: false };
  }
  return { startYear: seasonStart, endYear: seasonStart, isCurrent: false };
}

// ---------------------------------------------------------------------------
// Row mappers (shared with the public profile loader)
// ---------------------------------------------------------------------------

type HistoryRow = Pick<
  Database["public"]["Tables"]["player_history"]["Row"],
  | "id"
  | "season"
  | "season_start"
  | "club_name"
  | "league"
  | "position"
  | "appearances"
  | "goals"
  | "assists"
  | "clean_sheets"
  | "goals_against"
  | "notes"
> & { level: { name: string } | null };

type AchievementRow = Pick<
  Database["public"]["Tables"]["achievements"]["Row"],
  "id" | "kind" | "title" | "season" | "club_name" | "detail"
>;

export function mapHistoryRow(h: HistoryRow): PlayerHistoryEntry {
  const { isCurrent } = parseSeason(h.season, h.season_start);
  return {
    id: h.id,
    season: h.season,
    club: h.club_name,
    level: h.level?.name ?? "—",
    ...(h.league ? { league: h.league } : {}),
    ...(h.position ? { position: h.position } : {}),
    ...(h.appearances !== null ? { appearances: h.appearances } : {}),
    ...(h.goals !== null ? { goals: h.goals } : {}),
    ...(h.assists !== null ? { assists: h.assists } : {}),
    ...(h.clean_sheets !== null ? { cleanSheets: h.clean_sheets } : {}),
    ...(h.goals_against !== null ? { goalsAgainst: h.goals_against } : {}),
    ...(h.notes ? { notes: h.notes } : {}),
    ...(isCurrent ? { isCurrent: true } : {}),
  };
}

export function mapAchievementRow(a: AchievementRow): Achievement {
  return {
    id: a.id,
    kind: a.kind as AchievementKind,
    title: a.title,
    ...(a.season ? { season: a.season } : {}),
    ...(a.club_name ? { club: a.club_name } : {}),
    ...(a.detail ? { detail: a.detail } : {}),
  };
}

/** Ongoing spells first, then by start year (newest first). */
export function sortHistoryRows<T extends { season: string; season_start: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ac = parseSeason(a.season, a.season_start).isCurrent ? 1 : 0;
    const bc = parseSeason(b.season, b.season_start).isCurrent ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return b.season_start - a.season_start;
  });
}

export const historySelect = `id, season, season_start, club_name, league, position, appearances, goals, assists, clean_sheets, goals_against, notes,
   level:levels!player_history_level_id_fkey ( name )`;
export const achievementSelect = "id, kind, title, season, club_name, detail, created_at";

/** Loads history + achievements for any player id (RLS: readable by authenticated). */
export async function fetchPlayerCv(playerId: string): Promise<{
  history: PlayerHistoryEntry[];
  achievements: Achievement[];
}> {
  const [historyRes, achievementRes] = await Promise.all([
    supabase
      .from("player_history")
      .select(historySelect)
      .eq("player_id", playerId)
      .order("season_start", { ascending: false }),
    supabase
      .from("achievements")
      .select(achievementSelect)
      .eq("profile_id", playerId)
      .order("created_at", { ascending: false }),
  ]);
  if (historyRes.error) throw historyRes.error;
  if (achievementRes.error) throw achievementRes.error;
  return {
    history: sortHistoryRows(historyRes.data ?? []).map(mapHistoryRow),
    achievements: (achievementRes.data ?? []).map(mapAchievementRow),
  };
}

// ---------------------------------------------------------------------------
// Editable forms
// ---------------------------------------------------------------------------

export interface PlayerHistoryForm {
  clubName: string;
  levelId: number | null;
  startYear: number | null;
  /** null = ongoing / current club */
  endYear: number | null;
  isCurrent: boolean;
  position: DbPosition | null;
  league: string;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  /** Goalkeeper stats — used instead of goals/assists when position is GK. */
  cleanSheets: number | null;
  goalsAgainst: number | null;
  notes: string;
}

export interface AchievementForm {
  kind: AchievementKind;
  title: string;
  season: string;
  clubName: string;
  detail: string;
}

export function emptyHistoryForm(): PlayerHistoryForm {
  return {
    clubName: "",
    levelId: null,
    startYear: null,
    endYear: null,
    isCurrent: false,
    position: null,
    league: "",
    appearances: null,
    goals: null,
    assists: null,
    cleanSheets: null,
    goalsAgainst: null,
    notes: "",
  };
}

export function emptyAchievementForm(): AchievementForm {
  return { kind: "award", title: "", season: "", clubName: "", detail: "" };
}

/** Returns a user-facing error, or null when the form is valid. */
export function validateHistoryForm(form: PlayerHistoryForm): string | null {
  const thisYear = currentYear();
  if (!form.clubName.trim()) return "Please add the club or team name.";
  if (form.startYear === null || !Number.isInteger(form.startYear)) return "Please add a start year.";
  if (form.startYear < MIN_HISTORY_YEAR || form.startYear > thisYear + 1)
    return `Start year should be between ${MIN_HISTORY_YEAR} and ${thisYear + 1}.`;
  if (!form.isCurrent) {
    if (form.endYear === null || !Number.isInteger(form.endYear))
      return "Please add an end year, or mark this as your current club.";
    if (form.endYear < form.startYear) return "End year can't be before the start year.";
    if (form.endYear > thisYear + 1) return `End year should be no later than ${thisYear + 1}.`;
  }
  for (const [label, value] of [
    ["Appearances", form.appearances],
    ["Goals", form.goals],
    ["Assists", form.assists],
    ["Clean sheets", form.cleanSheets],
    ["Goals against", form.goalsAgainst],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 2000))
      return `${label} should be a whole number between 0 and 2000.`;
  }
  return null;
}

export function validateAchievementForm(form: AchievementForm): string | null {
  if (!form.title.trim()) return "Please add a title for the achievement.";
  if (!achievementKinds.includes(form.kind)) return "Please choose an achievement type.";
  const season = form.season.trim();
  if (season && !/^\d{4}(\s*[/–-]\s*\d{2,4})?$/.test(season))
    return "Season should look like 2024 or 2023/24.";
  return null;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("You need to be signed in to update your profile.");
  return data.user.id;
}

function historyPayload(form: PlayerHistoryForm) {
  const startYear = form.startYear!;
  const endYear = form.isCurrent ? null : form.endYear;
  return {
    club_name: form.clubName.trim(),
    level_id: form.levelId,
    season_start: startYear,
    season: seasonLabel(startYear, endYear),
    position: form.position,
    league: form.league.trim() || null,
    appearances: form.appearances,
    goals: form.goals,
    assists: form.assists,
    clean_sheets: form.cleanSheets,
    goals_against: form.goalsAgainst,
    notes: form.notes.trim() || null,
  };
}

function achievementPayload(form: AchievementForm) {
  return {
    kind: form.kind,
    title: form.title.trim(),
    season: form.season.trim() || null,
    club_name: form.clubName.trim() || null,
    detail: form.detail.trim() || null,
  };
}

/** Loads one of the signed-in player's own history rows into the editable form. */
export async function fetchMyHistoryEntry(id: string): Promise<PlayerHistoryForm | null> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("player_history")
    .select("id, season, season_start, club_name, level_id, league, position, appearances, goals, assists, clean_sheets, goals_against, notes")
    .eq("id", id)
    .eq("player_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = parseSeason(data.season, data.season_start);
  return {
    clubName: data.club_name,
    levelId: data.level_id,
    startYear: parsed.startYear,
    endYear: parsed.endYear,
    isCurrent: parsed.isCurrent,
    position: (data.position as DbPosition | null) ?? null,
    league: data.league ?? "",
    appearances: data.appearances,
    goals: data.goals,
    assists: data.assists,
    cleanSheets: data.clean_sheets,
    goalsAgainst: data.goals_against,
    notes: data.notes ?? "",
  };
}

export async function fetchMyAchievement(id: string): Promise<AchievementForm | null> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("achievements")
    .select("id, kind, title, season, club_name, detail")
    .eq("id", id)
    .eq("profile_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    kind: data.kind as AchievementKind,
    title: data.title,
    season: data.season ?? "",
    clubName: data.club_name ?? "",
    detail: data.detail ?? "",
  };
}

export function useMyHistoryEntry(id: string | null) {
  return useQuery({
    queryKey: ["my-history-entry", id],
    queryFn: () => fetchMyHistoryEntry(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useMyAchievement(id: string | null) {
  return useQuery({
    queryKey: ["my-achievement", id],
    queryFn: () => fetchMyAchievement(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

function useInvalidateCv() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["signed-in-player-profile"] });
    void queryClient.invalidateQueries({ queryKey: ["signed-in-player-extras"] });
    void queryClient.invalidateQueries({ queryKey: ["my-history-entry"] });
    void queryClient.invalidateQueries({ queryKey: ["my-achievement"] });
    void queryClient.invalidateQueries({ queryKey: ["public-player-profile"] });
  };
}

export function useSaveHistoryEntry() {
  const invalidate = useInvalidateCv();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: PlayerHistoryForm }) => {
      const problem = validateHistoryForm(form);
      if (problem) throw new Error(problem);
      const uid = await requireUserId();
      const payload = historyPayload(form);
      if (id) {
        const { data, error } = await supabase
          .from("player_history")
          .update(payload)
          .eq("id", id)
          .eq("player_id", uid)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("That history entry could not be updated.");
        return data.id;
      }
      const { data, error } = await supabase
        .from("player_history")
        .insert({ ...payload, player_id: uid })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteHistoryEntry() {
  const invalidate = useInvalidateCv();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireUserId();
      const { error } = await supabase
        .from("player_history")
        .delete()
        .eq("id", id)
        .eq("player_id", uid);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveAchievement() {
  const invalidate = useInvalidateCv();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: AchievementForm }) => {
      const problem = validateAchievementForm(form);
      if (problem) throw new Error(problem);
      const uid = await requireUserId();
      const payload = achievementPayload(form);
      if (id) {
        const { data, error } = await supabase
          .from("achievements")
          .update(payload)
          .eq("id", id)
          .eq("profile_id", uid)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("That achievement could not be updated.");
        return data.id;
      }
      const { data, error } = await supabase
        .from("achievements")
        .insert({ ...payload, profile_id: uid })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAchievement() {
  const invalidate = useInvalidateCv();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireUserId();
      const { error } = await supabase
        .from("achievements")
        .delete()
        .eq("id", id)
        .eq("profile_id", uid);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
