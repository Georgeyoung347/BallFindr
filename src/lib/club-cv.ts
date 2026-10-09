/**
 * Club football CV: season-by-season club history (club_history) and club
 * achievements (achievements, shared with players via profile_id).
 *
 * All writes go through the authenticated browser client and are additionally
 * scoped to the signed-in club's id, so the existing RLS policies
 * (auth.uid() = club_id / profile_id) are the enforcing boundary — a club can
 * never touch another club's rows. Reads are public to signed-in users, which
 * is what the player-facing club profile uses.
 *
 * Seasons: club_history stores a free-text `season` label plus a numeric
 * `season_start` used for ordering. We derive `season_start` from the label.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  achievementKindLabels,
  type Achievement,
  type AchievementKind,
  type ClubHistoryEntry,
} from "@/data/profile-model";
import { mapAchievementRow, achievementSelect, MIN_HISTORY_YEAR, currentYear } from "@/lib/player-cv";

export const clubAchievementKinds = Object.keys(achievementKindLabels) as AchievementKind[];

export const clubOutcomes = ["none", "promoted", "relegated", "champions"] as const;
export type ClubOutcome = (typeof clubOutcomes)[number];

export const clubOutcomeLabels: Record<ClubOutcome, string> = {
  none: "No promotion or relegation",
  promoted: "Promoted",
  relegated: "Relegated",
  champions: "League champions",
};

/** Pulls the opening four-digit year out of a season label such as "2023/24". */
export function seasonStartFrom(season: string): number | null {
  const match = season.trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

type ClubHistoryRow = Pick<
  Database["public"]["Tables"]["club_history"]["Row"],
  "id" | "season" | "season_start" | "league" | "final_position" | "outcome" | "cup_achievement" | "notes" | "wins" | "draws" | "losses"
> & { level: { name: string } | null };

export function mapClubHistoryRow(h: ClubHistoryRow): ClubHistoryEntry {
  const outcome = (h.outcome ?? "none") as ClubOutcome;
  return {
    id: h.id,
    season: h.season,
    league: h.league,
    level: h.level?.name ?? "—",
    ...(h.final_position ? { finalPosition: h.final_position } : {}),
    outcome: (clubOutcomes as readonly string[]).includes(outcome) ? outcome : "none",
    ...(h.cup_achievement ? { cupAchievement: h.cup_achievement } : {}),
    ...(h.notes ? { notes: h.notes } : {}),
    ...(h.wins != null ? { wins: h.wins } : {}),
    ...(h.draws != null ? { draws: h.draws } : {}),
    ...(h.losses != null ? { losses: h.losses } : {}),
  };
}

export const clubHistorySelect = `id, season, season_start, league, final_position, outcome, cup_achievement, notes, wins, draws, losses,
   level:levels!club_history_level_id_fkey ( name )`;

/** Loads history + achievements for any club id (readable by authenticated users). */
export async function fetchClubCv(clubId: string): Promise<{
  history: ClubHistoryEntry[];
  achievements: Achievement[];
}> {
  const [historyRes, achievementRes] = await Promise.all([
    supabase
      .from("club_history")
      .select(clubHistorySelect)
      .eq("club_id", clubId)
      .order("season_start", { ascending: false }),
    supabase
      .from("achievements")
      .select(achievementSelect)
      .eq("profile_id", clubId)
      .order("created_at", { ascending: false }),
  ]);
  if (historyRes.error) throw historyRes.error;
  if (achievementRes.error) throw achievementRes.error;
  return {
    history: (historyRes.data ?? []).map(mapClubHistoryRow),
    achievements: (achievementRes.data ?? []).map(mapAchievementRow),
  };
}

export function useClubCv(clubId: string | undefined) {
  return useQuery({
    queryKey: ["club-cv", clubId],
    queryFn: () => fetchClubCv(clubId!),
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Editable forms
// ---------------------------------------------------------------------------

export interface ClubHistoryForm {
  season: string;
  league: string;
  levelId: number | null;
  finalPosition: string;
  outcome: ClubOutcome;
  cupAchievement: string;
  notes: string;
  wins: string;
  draws: string;
  losses: string;
}

export interface ClubAchievementForm {
  kind: AchievementKind;
  title: string;
  season: string;
  detail: string;
}

export function emptyClubHistoryForm(): ClubHistoryForm {
  return {
    season: "",
    league: "",
    levelId: null,
    finalPosition: "",
    outcome: "none",
    cupAchievement: "",
    notes: "",
    wins: "",
    draws: "",
    losses: "",
  };
}

export function emptyClubAchievementForm(): ClubAchievementForm {
  return { kind: "league_title", title: "", season: "", detail: "" };
}

export function validateClubHistoryForm(form: ClubHistoryForm): string | null {
  const season = form.season.trim();
  if (!season) return "Please add the season, e.g. 2023/24.";
  if (!/^\d{4}(\s*[/–-]\s*\d{2,4})?$/.test(season))
    return "Season should look like 2024 or 2023/24.";
  const start = seasonStartFrom(season);
  const thisYear = currentYear();
  if (start === null || start < MIN_HISTORY_YEAR || start > thisYear + 1)
    return `Season should start between ${MIN_HISTORY_YEAR} and ${thisYear + 1}.`;
  if (!form.league.trim()) return "Please add the league or competition.";
  if (!(clubOutcomes as readonly string[]).includes(form.outcome))
    return "Please choose a season outcome.";
  for (const [label, v] of [["Wins", form.wins], ["Draws", form.draws], ["Losses", form.losses]] as const) {
    if (v.trim() && !/^\d{1,3}$/.test(v.trim())) return `${label} must be a whole number between 0 and 999.`;
  }
  return null;
}

export function validateClubAchievementForm(form: ClubAchievementForm): string | null {
  if (!form.title.trim()) return "Please add a title for the achievement.";
  if (!clubAchievementKinds.includes(form.kind)) return "Please choose an achievement type.";
  const season = form.season.trim();
  if (season && !/^\d{4}(\s*[/–-]\s*\d{2,4})?$/.test(season))
    return "Season should look like 2024 or 2023/24.";
  return null;
}

async function requireClubId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("You need to be signed in to update your club profile.");
  return data.user.id;
}

function clubHistoryPayload(form: ClubHistoryForm) {
  const season = form.season.trim();
  return {
    season,
    season_start: seasonStartFrom(season)!,
    league: form.league.trim(),
    level_id: form.levelId,
    final_position: form.finalPosition.trim() || null,
    outcome: form.outcome === "none" ? null : form.outcome,
    cup_achievement: form.cupAchievement.trim() || null,
    notes: form.notes.trim() || null,
    wins: form.wins.trim() ? Number(form.wins.trim()) : null,
    draws: form.draws.trim() ? Number(form.draws.trim()) : null,
    losses: form.losses.trim() ? Number(form.losses.trim()) : null,
  };
}

function clubAchievementPayload(form: ClubAchievementForm, clubName: string | null) {
  return {
    kind: form.kind,
    title: form.title.trim(),
    season: form.season.trim() || null,
    club_name: clubName,
    detail: form.detail.trim() || null,
  };
}

export async function fetchMyClubHistoryEntry(id: string): Promise<ClubHistoryForm | null> {
  const uid = await requireClubId();
  const { data, error } = await supabase
    .from("club_history")
    .select("id, season, league, level_id, final_position, outcome, cup_achievement, notes, wins, draws, losses")
    .eq("id", id)
    .eq("club_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const outcome = (data.outcome ?? "none") as ClubOutcome;
  return {
    season: data.season,
    league: data.league,
    levelId: data.level_id,
    finalPosition: data.final_position ?? "",
    outcome: (clubOutcomes as readonly string[]).includes(outcome) ? outcome : "none",
    cupAchievement: data.cup_achievement ?? "",
    notes: data.notes ?? "",
    wins: data.wins != null ? String(data.wins) : "",
    draws: data.draws != null ? String(data.draws) : "",
    losses: data.losses != null ? String(data.losses) : "",
  };
}

export async function fetchMyClubAchievement(id: string): Promise<ClubAchievementForm | null> {
  const uid = await requireClubId();
  const { data, error } = await supabase
    .from("achievements")
    .select("id, kind, title, season, detail")
    .eq("id", id)
    .eq("profile_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    kind: data.kind as AchievementKind,
    title: data.title,
    season: data.season ?? "",
    detail: data.detail ?? "",
  };
}

export function useMyClubHistoryEntry(id: string | null) {
  return useQuery({
    queryKey: ["my-club-history-entry", id],
    queryFn: () => fetchMyClubHistoryEntry(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useMyClubAchievement(id: string | null) {
  return useQuery({
    queryKey: ["my-club-achievement", id],
    queryFn: () => fetchMyClubAchievement(id!),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

function useInvalidateClubCv() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["signed-in-club-profile"] });
    void queryClient.invalidateQueries({ queryKey: ["club-cv"] });
    void queryClient.invalidateQueries({ queryKey: ["my-club-history-entry"] });
    void queryClient.invalidateQueries({ queryKey: ["my-club-achievement"] });
  };
}

export function useSaveClubHistoryEntry() {
  const invalidate = useInvalidateClubCv();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: ClubHistoryForm }) => {
      const problem = validateClubHistoryForm(form);
      if (problem) throw new Error(problem);
      const uid = await requireClubId();
      const payload = clubHistoryPayload(form);
      if (id) {
        const { data, error } = await supabase
          .from("club_history")
          .update(payload)
          .eq("id", id)
          .eq("club_id", uid)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("That history entry could not be updated.");
        return data.id;
      }
      const { data, error } = await supabase
        .from("club_history")
        .insert({ ...payload, club_id: uid })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteClubHistoryEntry() {
  const invalidate = useInvalidateClubCv();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireClubId();
      const { error } = await supabase
        .from("club_history")
        .delete()
        .eq("id", id)
        .eq("club_id", uid);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveClubAchievement() {
  const invalidate = useInvalidateClubCv();
  return useMutation({
    mutationFn: async ({ id, form }: { id: string | null; form: ClubAchievementForm }) => {
      const problem = validateClubAchievementForm(form);
      if (problem) throw new Error(problem);
      const uid = await requireClubId();
      const { data: clubRow } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", uid)
        .maybeSingle();
      const payload = clubAchievementPayload(form, clubRow?.name ?? null);
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

export function useDeleteClubAchievement() {
  const invalidate = useInvalidateClubCv();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireClubId();
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
