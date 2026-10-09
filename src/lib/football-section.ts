/**
 * Men's / Women's football sections.
 *
 * One BallFindr app, one database.
 *  - Players carry exactly one `football_section` ("mens" or "womens").
 *  - Clubs carry `football_section` ("mens", "womens" or "both") plus an
 *    `active_section` ("mens" or "womens") that decides which player pool the
 *    club is currently recruiting from.
 *
 * Separation is enforced in the database by restrictive RLS policies
 * (private.section_visible / private.my_section, which reads a club's ACTIVE
 * section), so these helpers are for labelling and for mirroring the filter in
 * queries — never the only line of defence.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** A single side of the game. Players always have exactly one of these. */
export type FootballSection = "mens" | "womens";
/** What a club operates: one side, or both. */
export type ClubSection = FootballSection | "both";

export const FOOTBALL_SECTIONS: { value: FootballSection; label: string }[] = [
  { value: "mens", label: "Men's Football" },
  { value: "womens", label: "Women's Football" },
];

export const CLUB_SECTIONS: { value: ClubSection; label: string }[] = [
  { value: "mens", label: "Men's Football" },
  { value: "womens", label: "Women's Football" },
  { value: "both", label: "Men's & Women's Football" },
];

export function sectionLabel(section: ClubSection | null | undefined): string {
  if (section === "womens") return "Women's";
  if (section === "mens") return "Men's";
  if (section === "both") return "Both";
  return "—";
}

export function sectionFullLabel(section: ClubSection | null | undefined): string {
  if (section === "womens") return "Women's Football";
  if (section === "mens") return "Men's Football";
  if (section === "both") return "Men's & Women's Football";
  return "—";
}

export function asSection(value: unknown): FootballSection | null {
  return value === "womens" ? "womens" : value === "mens" ? "mens" : null;
}

export function asClubSection(value: unknown): ClubSection | null {
  return value === "both" ? "both" : asSection(value);
}

export interface MyClubSection {
  /** What the club operates. */
  section: ClubSection;
  /** The side the club is currently recruiting in. */
  activeSection: FootballSection;
}

/** The signed-in club's own section settings, or null for non-club accounts. */
export async function fetchMyClubSection(): Promise<MyClubSection | null> {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) return null;
  const { data } = await supabase
    .from("clubs")
    .select("football_section, active_section")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const section = asClubSection(data.football_section) ?? "mens";
  const activeSection =
    section === "both" ? (asSection(data.active_section) ?? "mens") : section;
  return { section, activeSection };
}

export function useMyClubSection() {
  return useQuery({
    queryKey: ["my-club-section"],
    queryFn: fetchMyClubSection,
    staleTime: 5 * 60_000,
  });
}

/**
 * The section the signed-in account currently operates in: a player's own
 * section, or a club's ACTIVE section. This mirrors private.my_section().
 */
export async function fetchMyFootballSection(): Promise<FootballSection | null> {
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) return null;
  const [player, club] = await Promise.all([
    supabase.from("players").select("football_section").eq("id", id).maybeSingle(),
    supabase.from("clubs").select("football_section, active_section").eq("id", id).maybeSingle(),
  ]);
  if (player.data) return asSection(player.data.football_section);
  if (!club.data) return null;
  const clubSection = asClubSection(club.data.football_section) ?? "mens";
  return clubSection === "both" ? (asSection(club.data.active_section) ?? "mens") : clubSection;
}

export function useMyFootballSection() {
  return useQuery({
    queryKey: ["my-football-section"],
    queryFn: fetchMyFootballSection,
    staleTime: 5 * 60_000,
  });
}

/**
 * Switches which side a "both" club is operating in. The database keeps
 * active_section pinned to the club's own section when it isn't "both", so
 * this can never widen what a single-section club can see.
 */
export function useSetActiveSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activeSection: FootballSection) => {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) throw new Error("You need to be signed in to switch section.");
      const { error } = await supabase
        .from("clubs")
        .update({ active_section: activeSection })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      // Every club-facing recruitment read is section-scoped, so refresh all of it.
      await queryClient.invalidateQueries();
    },
  });
}
