/**
 * Reads and writes the signed-in club's real vacancies in Supabase.
 *
 * Table: vacancies (club_id = auth.uid() through existing RLS).
 * levels is read-only reference data via usePlayerLevels().
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingDay } from "@/data/app-config";
import { dbPositions, type DbPosition } from "@/lib/player-profile";
import { fetchMyFootballSection } from "@/lib/football-section";

export const vacancyStatuses = ["active", "closed", "filled", "expired"] as const;
export type VacancyStatus = (typeof vacancyStatuses)[number];

export const vacancyStatusLabels: Record<VacancyStatus, string> = {
  active: "Active",
  closed: "Closed",
  filled: "Filled",
  expired: "Expired",
};

export const positionLabels: Record<DbPosition, string> = {
  GK: "Goalkeeper",
  RB: "Right Back",
  CB: "Centre Back",
  LB: "Left Back",
  CDM: "Defensive Midfielder",
  CM: "Central Midfielder",
  CAM: "Attacking Midfielder",
  RW: "Right Winger",
  LW: "Left Winger",
  ST: "Striker",
};

/** True when every position is selected — the "All Positions" option. */
export function isAllPositions(positions: readonly string[]): boolean {
  return dbPositions.every((p) => positions.includes(p));
}

/**
 * The single source of truth for a vacancy's title: always generated from the
 * stored position selection, in the order the club selected them.
 */
export function vacancyTitleFor(positions: readonly string[] | null | undefined): string | null {
  const list = (positions ?? []).filter(Boolean);
  if (!list.length) return null;
  if (isAllPositions(list)) return "All Positions Wanted";
  return `${list.join(", ")} Wanted`;
}

export const matchDayOptions = [
  "Saturday",
  "Sunday",
  "Midweek",
] as const;

export interface ClubVacancy {
  id: string;
  positions: DbPosition[];
  title: string | null;
  levelId: number | null;
  levelName: string | null;
  location: string | null;
  trainingDays: TrainingDay[];
  matchDay: string | null;
  description: string | null;
  requirements: string | null;
  trialsAvailable: boolean;
  status: VacancyStatus;
  expiresAt: string | null;
  createdAt: string;
}

export interface VacancyForm {
  positions: DbPosition[];
  title: string;
  levelId: number | null;
  location: string;
  trainingDays: TrainingDay[];
  matchDay: string;
  description: string;
  requirements: string;
  trialsAvailable: boolean;
  status: VacancyStatus;
  expiresAt: string; // yyyy-mm-dd or ""
}

export const emptyVacancyForm: VacancyForm = {
  positions: [],
  title: "",
  levelId: null,
  location: "",
  trainingDays: [],
  matchDay: "",
  description: "",
  requirements: "",
  trialsAvailable: false,
  status: "active",
  expiresAt: "",
};

const vacancySelect = `id, positions, title, level_id, location, training_days, match_day,
  description, requirements, trials_available, status, expires_at, created_at,
  level:levels!vacancies_level_id_fkey ( name )`;

type Row = {
  id: string;
  positions: string[] | null;
  title: string | null;
  level_id: number | null;
  location: string | null;
  training_days: string[] | null;
  match_day: string | null;
  description: string | null;
  requirements: string | null;
  trials_available: boolean;
  status: string;
  expires_at: string | null;
  created_at: string;
  level: { name: string } | null;
};

function toVacancy(row: Row): ClubVacancy {
  return {
    id: row.id,
    positions: (row.positions ?? []) as DbPosition[],
    title: vacancyTitleFor(row.positions) ?? row.title,
    levelId: row.level_id,
    levelName: row.level?.name ?? null,
    location: row.location,
    trainingDays: (row.training_days ?? []) as TrainingDay[],
    matchDay: row.match_day,
    description: row.description,
    requirements: row.requirements,
    trialsAvailable: row.trials_available,
    status: (vacancyStatuses as readonly string[]).includes(row.status)
      ? (row.status as VacancyStatus)
      : "active",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("You need to be signed in as a club to manage vacancies.");
  return data.user.id;
}

export async function fetchClubVacancies(): Promise<ClubVacancy[]> {
  const userId = await requireUserId();
  // A club that operates both sections only manages the side it is currently
  // active in; each vacancy's section is set by the database when it is posted.
  const mySection = await fetchMyFootballSection();
  let query = supabase
    .from("vacancies")
    .select(vacancySelect)
    .eq("club_id", userId);
  if (mySection) query = query.eq("football_section", mySection);
  const { data, error } = await query
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toVacancy);
}

export function useClubVacancies() {
  return useQuery({ queryKey: ["club-vacancies"], queryFn: fetchClubVacancies, staleTime: 15_000 });
}

export async function fetchClubVacancy(id: string): Promise<ClubVacancy | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("vacancies")
    .select(vacancySelect)
    .eq("id", id)
    .eq("club_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toVacancy(data as unknown as Row) : null;
}

export function useClubVacancy(id: string) {
  return useQuery({
    queryKey: ["club-vacancy", id],
    queryFn: () => fetchClubVacancy(id),
    staleTime: 0,
  });
}

export function toForm(v: ClubVacancy): VacancyForm {
  return {
    positions: v.positions,
    title: v.title ?? "",
    levelId: v.levelId,
    location: v.location ?? "",
    trainingDays: v.trainingDays,
    matchDay: v.matchDay ?? "",
    description: v.description ?? "",
    requirements: v.requirements ?? "",
    trialsAvailable: v.trialsAvailable,
    status: v.status,
    expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : "",
  };
}

function toPayload(form: VacancyForm) {
  return {
    positions: form.positions,
    title: vacancyTitleFor(form.positions),
    level_id: form.levelId,
    location: form.location.trim() || null,
    training_days: form.trainingDays,
    match_day: form.matchDay.trim() || null,
    description: form.description.trim() || null,
    requirements: form.requirements.trim() || null,
    trials_available: form.trialsAvailable,
    status: form.status,
    expires_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59Z`).toISOString() : null,
  };
}

export async function createVacancy(form: VacancyForm): Promise<string> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("vacancies")
    .insert({ ...toPayload(form), club_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateVacancy(id: string, form: VacancyForm): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("vacancies")
    .update(toPayload(form))
    .eq("id", id)
    .eq("club_id", userId);
  if (error) throw error;
}

export async function setVacancyStatus(id: string, status: VacancyStatus): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("vacancies")
    .update({ status })
    .eq("id", id)
    .eq("club_id", userId);
  if (error) throw error;
}

function useInvalidateVacancies() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["club-vacancies"] });
    void queryClient.invalidateQueries({ queryKey: ["club-vacancy"] });
  };
}

export function useCreateVacancy() {
  const invalidate = useInvalidateVacancies();
  return useMutation({ mutationFn: createVacancy, onSuccess: invalidate });
}

export function useUpdateVacancy() {
  const invalidate = useInvalidateVacancies();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: VacancyForm }) => updateVacancy(id, form),
    onSuccess: invalidate,
  });
}

export function useSetVacancyStatus() {
  const invalidate = useInvalidateVacancies();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VacancyStatus }) =>
      setVacancyStatus(id, status),
    onSuccess: invalidate,
  });
}
