/**
 * Player-side discovery reads: real clubs and their active vacancies.
 *
 * Tables read: clubs (+ profiles via the shared id), vacancies, levels.
 * Everything runs as the signed-in user through the existing RLS policies
 * ("readable by authenticated users"). No fabricated distances or match
 * scores — fields the database cannot supply are simply omitted.
 */

import { isClubCoreInfoComplete } from "@/lib/profile-completion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingDay } from "@/data/app-config";
import type { DbPosition } from "@/lib/player-profile";
import { positionLabels, vacancyTitleFor } from "@/lib/club-vacancies";
import { resolveProfileImage } from "@/lib/profile-images";
import { toAmount, toFeePolicy, type ClubFees } from "@/lib/club-extras";
import { fetchMyFootballSection } from "@/lib/football-section";

export interface DiscoverClub {
  id: string;
  name: string;
  short: string;
  badgePath: string | null;
  badgeUrl: string | null;
  teamPhotoPath: string | null;
  teamPhotoUrl: string | null;
  homeGroundPhotoPath: string | null;
  homeGroundPhotoUrl: string | null;
  trainingPitchPhotoPath: string | null;
  trainingPitchPhotoUrl: string | null;
  location: string | null;
  league: string | null;
  levelId: number | null;
  levelName: string | null;
  homeGround: string | null;
  description: string | null;
  trainingDays: TrainingDay[];
  trainingLocation: string | null;
  founded: string | null;
  recruitmentStatus: string;
  fees: ClubFees;
  facilities: string[];
  facilitiesOther: string | null;
  isVerified: boolean;
  isOwner: boolean;
  isFounderClub: boolean;
}

export interface DiscoverVacancy {
  id: string;
  clubId: string;
  positions: DbPosition[];
  positionLabel: string | null;
  title: string | null;
  levelId: number | null;
  levelName: string | null;
  location: string | null;
  trainingDays: TrainingDay[];
  matchDay: string | null;
  description: string | null;
  requirements: string | null;
  trialsAvailable: boolean;
  createdAt: string;
}

export interface DiscoverResult {
  key: string;
  club: DiscoverClub;
  vacancy: DiscoverVacancy | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "FC";
  return parts
    .slice(0, 3)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "3 days ago" style label derived from the real created_at timestamp. */
export function postedAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

type ClubRow = {
  id: string;
  name: string;
  short_name: string | null;
  badge_path: string | null;
  team_photo_path: string | null;
  home_ground_photo_path: string | null;
  training_pitch_photo_path: string | null;
  location: string | null;
  league: string | null;
  level_id: number | null;
  home_ground: string | null;
  description: string | null;
  training_days: string[] | null;
  training_location: string | null;
  founded: string | null;
  recruitment_status: string;
  fees_policy: string | null;
  match_subs_fee: number | string | null;
  monthly_fee: number | string | null;
  yearly_fee: number | string | null;
  other_fee: number | string | null;
  other_fee_label: string | null;
  facilities: string[] | null;
  facilities_other: string | null;
  is_founder_club: boolean;
  level: { name: string } | null;
};

type VacancyRow = {
  id: string;
  club_id: string;
  positions: string[] | null;
  title: string | null;
  level_id: number | null;
  location: string | null;
  training_days: string[] | null;
  match_day: string | null;
  description: string | null;
  requirements: string | null;
  trials_available: boolean;
  created_at: string;
  expires_at: string | null;
  level: { name: string } | null;
};

export async function fetchDiscoverResults(): Promise<DiscoverResult[]> {
  // Men's / Women's separation is enforced by RLS; this filter mirrors it so the
  // query itself is section-scoped too.
  const mySection = await fetchMyFootballSection();
  let clubQuery = supabase
    .from("clubs")
    .select(
      `id, name, short_name, badge_path, team_photo_path, home_ground_photo_path, training_pitch_photo_path, location, league, level_id, home_ground, description,
         training_days, training_location, founded, recruitment_status, match_day,
         fees_policy, match_subs_fee, monthly_fee, yearly_fee, other_fee, other_fee_label, facilities, facilities_other, is_founder_club,
         level:levels!clubs_level_id_fkey ( name )`,
    );
  // Clubs that operate both sections appear to players on either side.
  if (mySection) clubQuery = clubQuery.in("football_section", [mySection, "both"]);

  const [clubRes, vacancyRes, profileRes] = await Promise.all([
    clubQuery.order("name"),
    supabase
      .from("vacancies")
      .select(
        `id, club_id, positions, title, level_id, location, training_days, match_day,
         description, requirements, trials_available, created_at, expires_at,
         level:levels!vacancies_level_id_fkey ( name )`,
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, verification_status, is_owner, is_hidden").eq("account_type", "club"),
  ]);
  if (clubRes.error) throw clubRes.error;
  if (vacancyRes.error) throw vacancyRes.error;
  if (profileRes.error) throw profileRes.error;
  const verifiedIds = new Set((profileRes.data ?? []).filter((p) => p.verification_status === "verified").map((p) => p.id));
  const ownerIds = new Set((profileRes.data ?? []).filter((p) => p.is_owner).map((p) => p.id));

  // Core Information completion is encouraged but does not affect discoverability.
  // Admin-hidden clubs (and their vacancies) are left out of discovery; they are not banned.
  const hiddenIds = new Set((profileRes.data ?? []).filter((p) => p.is_hidden).map((p) => p.id));
  // Only accounts whose current account type is Club: a Club → Player switch keeps a
  // leftover clubs row, which must not appear in discovery.
  const clubAccountIds = new Set((profileRes.data ?? []).map((p) => p.id));
  if (vacancyRes.data)
    vacancyRes.data = vacancyRes.data.filter((v) => !hiddenIds.has(v.club_id) && clubAccountIds.has(v.club_id));
  const completeClubRows = ((clubRes.data ?? []) as unknown as (ClubRow & { match_day: string | null })[])
    .filter((c) => !hiddenIds.has(c.id) && clubAccountIds.has(c.id));
  const clubs = await Promise.all(completeClubRows.map(async (c): Promise<DiscoverClub> => ({
    id: c.id,
    name: c.name,
    short: c.short_name?.trim() || initials(c.name),
    badgePath: c.badge_path,
    badgeUrl: await resolveProfileImage(c.badge_path),
    teamPhotoPath: c.team_photo_path,
    teamPhotoUrl: await resolveProfileImage(c.team_photo_path),
    homeGroundPhotoPath: c.home_ground_photo_path,
    homeGroundPhotoUrl: await resolveProfileImage(c.home_ground_photo_path),
    trainingPitchPhotoPath: c.training_pitch_photo_path,
    trainingPitchPhotoUrl: await resolveProfileImage(c.training_pitch_photo_path),
    location: c.location,
    league: c.league,
    levelId: c.level_id,
    levelName: c.level?.name ?? null,
    homeGround: c.home_ground,
    description: c.description,
    trainingDays: (c.training_days ?? []) as TrainingDay[],
    trainingLocation: c.training_location,
    founded: c.founded,
    recruitmentStatus: c.recruitment_status,
    fees: {
      policy: toFeePolicy(c.fees_policy),
      matchSubs: toAmount(c.match_subs_fee),
      monthly: toAmount(c.monthly_fee),
      yearly: toAmount(c.yearly_fee),
      other: toAmount(c.other_fee),
      otherLabel: c.other_fee_label,
    },
    facilities: (c.facilities ?? []).filter(Boolean),
    facilitiesOther: c.facilities_other,
    isVerified: verifiedIds.has(c.id),
    isOwner: ownerIds.has(c.id),
    isFounderClub: c.is_founder_club,
  })));
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const now = Date.now();
  const vacancies = ((vacancyRes.data ?? []) as unknown as VacancyRow[])
    .filter((v) => !v.expires_at || new Date(v.expires_at).getTime() > now)
    .map<DiscoverVacancy>((v) => {
      const positions = (v.positions ?? []) as DbPosition[];
      const first = positions[0];
      return {
        id: v.id,
        clubId: v.club_id,
        positions,
        positionLabel: vacancyTitleFor(positions),
        title: v.title,
        levelId: v.level_id,
        levelName: v.level?.name ?? null,
        location: v.location,
        trainingDays: (v.training_days ?? []) as TrainingDay[],
        matchDay: v.match_day,
        description: v.description,
        requirements: v.requirements,
        trialsAvailable: v.trials_available,
        createdAt: v.created_at,
      };
    });

  const results: DiscoverResult[] = [];
  const clubsWithVacancy = new Set<string>();
  for (const vacancy of vacancies) {
    const club = clubById.get(vacancy.clubId);
    if (!club) continue;
    clubsWithVacancy.add(club.id);
    results.push({ key: vacancy.id, club, vacancy });
  }
  for (const club of clubs) {
    if (!clubsWithVacancy.has(club.id)) results.push({ key: club.id, club, vacancy: null });
  }
  return results;
}

export function useDiscoverResults() {
  return useQuery({
    queryKey: ["discover-clubs"],
    queryFn: fetchDiscoverResults,
    staleTime: 30_000,
  });
}

export interface ClubDetail {
  club: DiscoverClub;
  vacancies: DiscoverVacancy[];
}

/** One real club plus its active (non-expired) vacancies. */
export async function fetchClubDetail(clubId: string): Promise<ClubDetail | null> {
  const [clubRes, vacancyRes, profileRes] = await Promise.all([
    supabase
      .from("clubs")
      .select(
         `id, name, short_name, badge_path, team_photo_path, home_ground_photo_path, training_pitch_photo_path, location, league, level_id, home_ground, description,
         training_days, training_location, founded, recruitment_status,
         fees_policy, match_subs_fee, monthly_fee, yearly_fee, other_fee, other_fee_label, facilities, facilities_other, is_founder_club,
         level:levels!clubs_level_id_fkey ( name )`,
      )
      .eq("id", clubId)
      .maybeSingle(),
    supabase
      .from("vacancies")
      .select(
        `id, club_id, positions, title, level_id, location, training_days, match_day,
         description, requirements, trials_available, created_at, expires_at,
         level:levels!vacancies_level_id_fkey ( name )`,
      )
      .eq("club_id", clubId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("verification_status, is_owner").eq("id", clubId).maybeSingle(),
  ]);
  if (clubRes.error) throw clubRes.error;
  if (vacancyRes.error) throw vacancyRes.error;
  if (profileRes.error) throw profileRes.error;
  if (!clubRes.data) return null;

  const c = clubRes.data as unknown as ClubRow;
  const club: DiscoverClub = {
    id: c.id,
    name: c.name,
    short: c.short_name?.trim() || initials(c.name),
    badgePath: c.badge_path,
    badgeUrl: await resolveProfileImage(c.badge_path),
    teamPhotoPath: c.team_photo_path,
    teamPhotoUrl: await resolveProfileImage(c.team_photo_path),
    homeGroundPhotoPath: c.home_ground_photo_path,
    homeGroundPhotoUrl: await resolveProfileImage(c.home_ground_photo_path),
    trainingPitchPhotoPath: c.training_pitch_photo_path,
    trainingPitchPhotoUrl: await resolveProfileImage(c.training_pitch_photo_path),
    location: c.location,
    league: c.league,
    levelId: c.level_id,
    levelName: c.level?.name ?? null,
    homeGround: c.home_ground,
    description: c.description,
    trainingDays: (c.training_days ?? []) as TrainingDay[],
    trainingLocation: c.training_location,
    founded: c.founded,
    recruitmentStatus: c.recruitment_status,
    fees: {
      policy: toFeePolicy(c.fees_policy),
      matchSubs: toAmount(c.match_subs_fee),
      monthly: toAmount(c.monthly_fee),
      yearly: toAmount(c.yearly_fee),
      other: toAmount(c.other_fee),
      otherLabel: c.other_fee_label,
    },
    facilities: (c.facilities ?? []).filter(Boolean),
    facilitiesOther: c.facilities_other,
    isVerified: profileRes.data?.verification_status === "verified",
    isOwner: Boolean(profileRes.data?.is_owner),
    isFounderClub: c.is_founder_club,
  };

  const now = Date.now();
  const vacancies = ((vacancyRes.data ?? []) as unknown as VacancyRow[])
    .filter((v) => !v.expires_at || new Date(v.expires_at).getTime() > now)
    .map<DiscoverVacancy>((v) => {
      const positions = (v.positions ?? []) as DbPosition[];
      const first = positions[0];
      return {
        id: v.id,
        clubId: v.club_id,
        positions,
        positionLabel: vacancyTitleFor(positions),
        title: v.title,
        levelId: v.level_id,
        levelName: v.level?.name ?? null,
        location: v.location,
        trainingDays: (v.training_days ?? []) as TrainingDay[],
        matchDay: v.match_day,
        description: v.description,
        requirements: v.requirements,
        trialsAvailable: v.trials_available,
        createdAt: v.created_at,
      };
    });

  return { club, vacancies };
}

export function useClubDetail(clubId: string) {
  return useQuery({
    queryKey: ["club-detail", clubId],
    queryFn: () => fetchClubDetail(clubId),
    staleTime: 15_000,
  });
}

/* ------------------------------------------------- single vacancy lookup */

export interface VacancyLookup {
  vacancy: DiscoverVacancy;
  status: string;
  /** active and not past its expiry date */
  isOpen: boolean;
}

/**
 * Reads ONE vacancy whatever its status, so a player arriving from a saved
 * opportunity or an application can still see a closed listing (read-only).
 */
export async function fetchVacancyById(vacancyId: string): Promise<VacancyLookup | null> {
  const { data, error } = await supabase
    .from("vacancies")
    .select(
      `id, club_id, positions, title, level_id, location, training_days, match_day,
       description, requirements, trials_available, created_at, expires_at, status,
       level:levels!vacancies_level_id_fkey ( name )`,
    )
    .eq("id", vacancyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const v = data as unknown as VacancyRow & { status: string };
  const positions = (v.positions ?? []) as DbPosition[];
  const first = positions[0];
  const expired = Boolean(v.expires_at && new Date(v.expires_at).getTime() <= Date.now());
  return {
    status: v.status,
    isOpen: v.status === "active" && !expired,
    vacancy: {
      id: v.id,
      clubId: v.club_id,
      positions,
      positionLabel: vacancyTitleFor(positions),
      title: v.title,
      levelId: v.level_id,
      levelName: v.level?.name ?? null,
      location: v.location,
      trainingDays: (v.training_days ?? []) as TrainingDay[],
      matchDay: v.match_day,
      description: v.description,
      requirements: v.requirements,
      trialsAvailable: v.trials_available,
      createdAt: v.created_at,
    },
  };
}

export function useVacancyById(vacancyId: string, enabled = true) {
  return useQuery({
    queryKey: ["vacancy", vacancyId],
    queryFn: () => fetchVacancyById(vacancyId),
    enabled: enabled && Boolean(vacancyId),
    staleTime: 15_000,
  });
}
