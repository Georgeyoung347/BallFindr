/**
 * Reads and writes the signed-in club's real record in Supabase and maps it
 * into the ClubProfileRecord shape the club UI already consumes.
 *
 * Tables read/written: profiles, clubs; levels is read-only reference data.
 * Writes are scoped to the authenticated user's own row so existing RLS
 * (auth.uid() = id) applies. Sections not yet connected (history,
 * achievements) stay empty so the existing empty states render.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrainingDay } from "@/data/app-config";
import type { ClubProfileRecord, RecruitmentStatus } from "@/data/profile-model";
import { fetchClubCv } from "@/lib/club-cv";
import { resolveProfileImage, updateClubImage, type ClubImageSlot } from "@/lib/profile-images";
import { toAmount, toFeePolicy, type ClubFees, type FeePolicy } from "@/lib/club-extras";
import { asClubSection, type ClubSection } from "@/lib/football-section";

export const recruitmentStatusValues = ["open", "selective", "closed"] as const;
export type DbRecruitmentStatus = (typeof recruitmentStatusValues)[number];

export const recruitmentStatusOptionLabels: Record<DbRecruitmentStatus, string> = {
  open: "Actively recruiting",
  selective: "Selectively recruiting",
  closed: "Not recruiting",
};

function toRecruitmentStatus(value: string | null | undefined): RecruitmentStatus {
  if (value === "closed") return "closed";
  if (value === "selective") return "selective";
  return "actively_recruiting";
}

export interface ClubProfileForm {
  badgePath: string | null;
  badgeUrl: string | null;
  teamPhotoPath: string | null;
  teamPhotoUrl: string | null;
  homeGroundPhotoPath: string | null;
  homeGroundPhotoUrl: string | null;
  trainingPitchPhotoPath: string | null;
  trainingPitchPhotoUrl: string | null;
  displayName: string;
  name: string;
  shortName: string;
  location: string;
  homeGround: string;
  league: string;
  levelId: number | null;
  founded: string;
  description: string;
  trainingDays: TrainingDay[];
  trainingLocation: string;
  trainingTime: string;
  matchDay: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  recruitmentStatus: DbRecruitmentStatus;
  feesPolicy: FeePolicy | null;
  matchSubsFee: number | null;
  monthlyFee: number | null;
  yearlyFee: number | null;
  otherFee: number | null;
  otherFeeLabel: string;
  facilities: string[];
  facilitiesOther: string;
  /** Men's, Women's or both — the club may change this itself. */
  footballSection: ClubSection;
}

function shortOf(name: string, shortName?: string | null): string {
  if (shortName?.trim()) return shortName.trim().slice(0, 4).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 3)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// Contact details are column-restricted in the database; the owning club reads
// them via the auth.uid()-bound my_club_contact() function instead.
const clubSelect = `id, name, short_name, badge_path, team_photo_path, home_ground_photo_path, training_pitch_photo_path, location, home_ground, league, level_id,
   founded, description, training_days, training_location, training_time, match_day,
   recruitment_status, fees_policy, match_subs_fee, monthly_fee, yearly_fee, other_fee, other_fee_label,
    facilities, facilities_other, is_founder_club, football_section,
   level:levels!clubs_level_id_fkey ( name )`;

type ClubContact = { contact_name: string | null; contact_role: string | null; contact_email: string | null };

async function fetchOwnClubContact(): Promise<ClubContact> {
  const { data, error } = await supabase.rpc("my_club_contact");
  if (error) throw error;
  const row = (data as ClubContact[] | null)?.[0];
  return row ?? { contact_name: null, contact_role: null, contact_email: null };
}

type ClubFeeColumns = {
  fees_policy?: string | null;
  match_subs_fee?: number | string | null;
  monthly_fee?: number | string | null;
  yearly_fee?: number | string | null;
  other_fee?: number | string | null;
  other_fee_label?: string | null;
};

export function clubFeesFrom(row: ClubFeeColumns | null | undefined): ClubFees {
  return {
    policy: toFeePolicy(row?.fees_policy),
    matchSubs: toAmount(row?.match_subs_fee),
    monthly: toAmount(row?.monthly_fee),
    yearly: toAmount(row?.yearly_fee),
    other: toAmount(row?.other_fee),
    otherLabel: row?.other_fee_label ?? null,
  };
}

export async function fetchSignedInClubProfile(): Promise<ClubProfileRecord | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, clubRes, contact] = await Promise.all([
    supabase.from("profiles").select("id, display_name, verification_status, is_owner").eq("id", user.id).maybeSingle(),
    supabase.from("clubs").select(clubSelect).eq("id", user.id).maybeSingle(),
    fetchOwnClubContact(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (clubRes.error) throw clubRes.error;

  const profile = profileRes.data;
  const club = clubRes.data;
  if (!profile) return null;

  const cv = await fetchClubCv(user.id);

  const name = club?.name || profile.display_name;
  const level = (club?.level as { name: string } | null)?.name;
  const trainingDays = ((club?.training_days ?? []) as string[]) as TrainingDay[];

  const [badgeUrl, teamPhotoUrl, homeGroundPhotoUrl, trainingPitchPhotoUrl] = await Promise.all([
    resolveProfileImage(club?.badge_path),
    resolveProfileImage(club?.team_photo_path),
    resolveProfileImage(club?.home_ground_photo_path),
    resolveProfileImage(club?.training_pitch_photo_path),
  ]);
  return {
    id: profile.id,
    name,
    isVerified: profile.verification_status === "verified",
    isOwner: profile.is_owner,
    isFounderClub: Boolean(club?.is_founder_club),
    short: shortOf(name, club?.short_name),
    ...(club?.badge_path ? { badgePath: club.badge_path } : {}),
    ...(badgeUrl ? { badgeUrl } : {}),
    ...(club?.team_photo_path ? { teamPhotoPath: club.team_photo_path } : {}),
    ...(teamPhotoUrl ? { teamPhotoUrl } : {}),
    ...(club?.home_ground_photo_path ? { homeGroundPhotoPath: club.home_ground_photo_path } : {}),
    ...(homeGroundPhotoUrl ? { homeGroundPhotoUrl } : {}),
    ...(club?.training_pitch_photo_path ? { trainingPitchPhotoPath: club.training_pitch_photo_path } : {}),
    ...(trainingPitchPhotoUrl ? { trainingPitchPhotoUrl } : {}),
    ...(club?.location ? { location: club.location } : {}),
    ...(club?.home_ground ? { homeGround: club.home_ground } : {}),
    ...(club?.league ? { league: club.league } : {}),
    ...(level ? { level } : {}),
    ...(club?.founded ? { founded: club.founded } : {}),
    ...(club?.description ? { description: club.description } : {}),
    trainingDays,
    ...(club?.training_location ? { trainingLocation: club.training_location } : {}),
    ...(club?.training_time ? { trainingTime: club.training_time } : {}),
    ...(club?.match_day ? { matchDay: club.match_day } : {}),
    ...(contact.contact_name ? { contactName: contact.contact_name } : {}),
    ...(contact.contact_role ? { contactRole: contact.contact_role } : {}),
    ...(contact.contact_email ? { contactEmail: contact.contact_email } : {}),
    fees: clubFeesFrom(club),
    facilities: ((club?.facilities ?? []) as string[]).filter(Boolean),
    ...(club?.facilities_other ? { facilitiesOther: club.facilities_other } : {}),
    history: cv.history,
    achievements: cv.achievements,
    recruitment: {
      status: toRecruitmentStatus(club?.recruitment_status),
      positionsRequired: [],
      positionsRecentlyFilled: [],
      ...(level ? { preferredPlayerLevel: level } : {}),
      preferredPositions: [],
      trainingDays,
      ...(club?.match_day ? { matchDay: club.match_day } : {}),
    },
  };
}

export function useSignedInClubProfile() {
  return useQuery({
    queryKey: ["signed-in-club-profile"],
    queryFn: fetchSignedInClubProfile,
    staleTime: 30_000,
  });
}

export async function fetchSignedInClubForm(): Promise<ClubProfileForm | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileRes, clubRes, contact] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("clubs").select(clubSelect).eq("id", user.id).maybeSingle(),
    fetchOwnClubContact(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (clubRes.error) throw clubRes.error;

  const c = clubRes.data;
  const status = (c?.recruitment_status ?? "open") as string;
  const [badgeUrl, teamPhotoUrl, homeGroundPhotoUrl, trainingPitchPhotoUrl] = await Promise.all([
    resolveProfileImage(c?.badge_path),
    resolveProfileImage(c?.team_photo_path),
    resolveProfileImage(c?.home_ground_photo_path),
    resolveProfileImage(c?.training_pitch_photo_path),
  ]);
  return {
    badgePath: c?.badge_path ?? null,
    badgeUrl,
    teamPhotoPath: c?.team_photo_path ?? null,
    teamPhotoUrl,
    homeGroundPhotoPath: c?.home_ground_photo_path ?? null,
    homeGroundPhotoUrl,
    trainingPitchPhotoPath: c?.training_pitch_photo_path ?? null,
    trainingPitchPhotoUrl,
    displayName: profileRes.data?.display_name ?? "",
    name: c?.name ?? profileRes.data?.display_name ?? "",
    shortName: c?.short_name ?? "",
    location: c?.location ?? "",
    homeGround: c?.home_ground ?? "",
    league: c?.league ?? "",
    levelId: c?.level_id ?? null,
    founded: c?.founded ?? "",
    description: c?.description ?? "",
    trainingDays: ((c?.training_days ?? []) as TrainingDay[]).filter(Boolean),
    trainingLocation: c?.training_location ?? "",
    trainingTime: c?.training_time ?? "",
    matchDay: c?.match_day ?? "",
    contactName: contact.contact_name ?? "",
    contactRole: contact.contact_role ?? "",
    contactEmail: contact.contact_email ?? "",
    recruitmentStatus: (recruitmentStatusValues as readonly string[]).includes(status)
      ? (status as DbRecruitmentStatus)
      : "open",
    feesPolicy: toFeePolicy(c?.fees_policy),
    matchSubsFee: toAmount(c?.match_subs_fee),
    monthlyFee: toAmount(c?.monthly_fee),
    yearlyFee: toAmount(c?.yearly_fee),
    otherFee: toAmount(c?.other_fee),
    otherFeeLabel: c?.other_fee_label ?? "",
    facilities: ((c?.facilities ?? []) as string[]).filter(Boolean),
    facilitiesOther: c?.facilities_other ?? "",
    footballSection: asClubSection(c?.football_section) ?? "mens",
  };
}

export async function saveClubImage(slot: ClubImageSlot, file: File | null, oldPath: string | null) {
  return updateClubImage(slot, file, oldPath);
}

export function useSignedInClubForm(enabled = true) {
  return useQuery({
    queryKey: ["signed-in-club-form"],
    queryFn: fetchSignedInClubForm,
    enabled,
    staleTime: 0,
  });
}

export async function saveSignedInClubProfile(form: ClubProfileForm) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("You need to be signed in to update your club profile.");

  const profileUpdate = await supabase
    .from("profiles")
    .update({ display_name: (form.displayName.trim() || form.name.trim()) })
    .eq("id", user.id);
  if (profileUpdate.error) throw profileUpdate.error;

  const clubUpdate = await supabase
    .from("clubs")
    .update({
      name: form.name.trim(),
      short_name: form.shortName.trim() || null,
      location: form.location.trim() || null,
      home_ground: form.homeGround.trim() || null,
      league: form.league.trim() || null,
      level_id: form.levelId,
      founded: form.founded.trim() || null,
      description: form.description.trim() || null,
      training_days: form.trainingDays,
      training_location: form.trainingLocation.trim() || null,
      training_time: form.trainingTime.trim() || null,
      match_day: form.matchDay.trim() || null,
      contact_name: form.contactName.trim() || null,
      contact_role: form.contactRole.trim() || null,
      contact_email: form.contactEmail.trim() || null,
      recruitment_status: form.recruitmentStatus,
      fees_policy: form.feesPolicy,
      match_subs_fee: form.feesPolicy === "listed" ? form.matchSubsFee : null,
      monthly_fee: form.feesPolicy === "listed" ? form.monthlyFee : null,
      yearly_fee: form.feesPolicy === "listed" ? form.yearlyFee : null,
      other_fee: form.feesPolicy === "listed" ? form.otherFee : null,
      other_fee_label: form.feesPolicy === "listed" ? form.otherFeeLabel.trim() || null : null,
      facilities: form.facilities,
      facilities_other: form.facilitiesOther.trim() || null,
      // Only the club itself or an admin may change this; a database trigger
      // re-asserts that and keeps active_section consistent.
      football_section: form.footballSection,
    })
    .eq("id", user.id);
  if (clubUpdate.error) throw clubUpdate.error;
}

export function useSaveClubProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSignedInClubProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["signed-in-club-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["signed-in-club-form"] });
      void queryClient.invalidateQueries({ queryKey: ["my-club-section"] });
      void queryClient.invalidateQueries({ queryKey: ["my-football-section"] });
      void queryClient.invalidateQueries({ queryKey: ["discover-players"] });
    },
  });
}
