/**
 * Trial outcomes — the ONE successful-connection system.
 *
 * Each existing trial invitation can get a single outcome (Signed / Not Signed),
 * recorded only by the inviting club via the record_trial_outcome database
 * function. "Signed" outcomes are BallFindr's Successful Connections: the
 * vacancy flow and the Invited to Trial page both write through the same call.
 * Trial invites, applications and history are never modified or deleted.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchClubTrialInvites, isInvitePassed, type TrialInvite } from "@/lib/trial-invites";
import { fetchMyFootballSection } from "@/lib/football-section";

export type TrialOutcome = "signed" | "not_signed";
export type OutcomeDisplay = TrialOutcome | "pending" | "passed";

export const outcomeLabels: Record<OutcomeDisplay, string> = {
  pending: "Pending",
  passed: "Passed",
  signed: "Signed",
  not_signed: "Not Signed",
};

export const outcomeTone: Record<OutcomeDisplay, string> = {
  pending: "border-border bg-elevated text-muted-foreground",
  passed: "border-border bg-elevated text-muted-foreground",
  signed: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  not_signed: "border-destructive/30 bg-destructive/10 text-destructive",
};

export interface ClubTrialEntry extends TrialInvite {
  outcome: OutcomeDisplay;
  outcomeAt: string | null;
  playerPosition: string | null;
}

const db = supabase as any;

export async function fetchClubTrialEntries(): Promise<ClubTrialEntry[]> {
  const invites = await fetchClubTrialInvites();
  if (!invites.length) return [];
  const ids = invites.map((i) => i.id);
  const playerIds = [...new Set(invites.map((i) => i.playerId))];
  const [outcomesRes, playersRes, mySection] = await Promise.all([
    db.from("trial_outcomes").select("trial_invite_id, outcome, created_at").in("trial_invite_id", ids),
    supabase.from("players").select("id, primary_position, football_section").in("id", playerIds),
    fetchMyFootballSection(),
  ]);
  if (outcomesRes.error) throw outcomesRes.error;
  const outcomes = new Map<string, { outcome: TrialOutcome; created_at: string }>(
    ((outcomesRes.data ?? []) as { trial_invite_id: string; outcome: TrialOutcome; created_at: string }[]).map(
      (o) => [o.trial_invite_id, o],
    ),
  );
  const players = new Map(
    ((playersRes.data ?? []) as { id: string; primary_position: string | null; football_section: string }[]).map(
      (p) => [p.id, p],
    ),
  );
  return invites
    .filter((i) => {
      // Respect the club's active section (Both clubs switch between sides).
      const p = players.get(i.playerId);
      return !mySection || !p || p.football_section === mySection;
    })
    .map((i) => {
      const o = outcomes.get(i.id);
      return {
        ...i,
        // A recorded Signed / Not Signed always wins; otherwise a pending invite
        // whose trial time has gone by shows as Passed.
        outcome: (o?.outcome ?? (isInvitePassed(i) ? "passed" : "pending")) as OutcomeDisplay,
        outcomeAt: o?.created_at ?? null,
        playerPosition: players.get(i.playerId)?.primary_position ?? null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function useClubTrialEntries() {
  return useQuery({ queryKey: ["club-trial-entries"], queryFn: fetchClubTrialEntries, staleTime: 10_000 });
}

export function useRecordTrialOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteId, outcome }: { inviteId: string; outcome: TrialOutcome }) => {
      const { error } = await db.rpc("record_trial_outcome", { _invite_id: inviteId, _outcome: outcome });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["club-trial-entries"] });
      void qc.invalidateQueries({ queryKey: ["admin", "connections"] });
    },
  });
}

/** Name search that matches first name, surname or full name. */
export function matchesName(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const n = name.toLowerCase();
  return q.split(/\s+/).every((part) => n.includes(part));
}

export interface SuccessfulConnection {
  id: string;
  createdAt: string;
  playerId: string;
  playerName: string;
  playerPosition: string | null;
  clubId: string;
  clubName: string;
  vacancyId: string | null;
  vacancyTitle: string | null;
  vacancyPositions: string[];
  trialDate: string | null;
}

export async function fetchSuccessfulConnections(): Promise<SuccessfulConnection[]> {
  const { data, error } = await db
    .from("trial_outcomes")
    .select(
      `id, created_at, player_id, club_id, vacancy_id,
       club:clubs!trial_outcomes_club_id_fkey ( name ),
       player:players!trial_outcomes_player_id_fkey ( primary_position, profile:profiles!players_id_fkey ( display_name ) ),
       vacancy:vacancies!trial_outcomes_vacancy_id_fkey ( title, positions ),
       invite:trial_invites!trial_outcomes_trial_invite_id_fkey ( trial_date )`,
    )
    .eq("outcome", "signed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    playerId: r.player_id,
    playerName: r.player?.profile?.display_name ?? "Player",
    playerPosition: r.player?.primary_position ?? null,
    clubId: r.club_id,
    clubName: r.club?.name ?? "Club",
    vacancyId: r.vacancy_id,
    vacancyTitle: r.vacancy?.title ?? null,
    vacancyPositions: r.vacancy?.positions ?? [],
    trialDate: r.invite?.trial_date ?? null,
  }));
}
