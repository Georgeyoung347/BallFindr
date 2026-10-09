/**
 * Pure functions computing profile completion percentage and missing items for players/clubs.
 */
import type { ClubProfileRecord, PlayerProfileRecord } from "@/data/profile-model";
import type { PlayerProfileExtras } from "@/lib/player-profile";

/**
 * Single source of truth for player profile strength — the exact 18-point
 * calculation previously inlined on the player Profile page. The Profile page
 * and the player Dashboard both render this, so they can never diverge.
 */
export function playerProfileStrength(
  p: PlayerProfileRecord,
  extras?: PlayerProfileExtras | null,
): number {
  const strengthChecks = [
    Boolean(p.fullName.trim()),
    Boolean(p.photoUrl),
    Boolean(p.heightInches),
    Boolean(p.location),
    Boolean(p.currentClub),
    Boolean(p.currentLevel),
    Boolean(p.primaryPosition),
    p.secondaryPositions.length > 0,
    Boolean(p.preferredLevel),
    Boolean(p.availability),
    p.preferredTrainingDays.length > 0,
    p.recruitment.openToTrials,
    Boolean(p.bio?.trim()),
    Boolean(p.recruitment.lookingFor.trim()),
    (extras?.historyCount ?? 0) > 0,
    (extras?.achievementsCount ?? 0) > 0,
    (extras?.mediaCount ?? 0) > 0,
  ];
  return Math.round((strengthChecks.filter(Boolean).length / strengthChecks.length) * 100);
}

/**
 * Club equivalent, mirroring the player calculation field-for-field across the
 * club profile's own sections (details, history, achievements, media, fees,
 * facilities). Used on the club Profile page and club Dashboard.
 */
export function clubProfileStrength(club: ClubProfileRecord): number {
  const fees = club.fees;
  const feeProvided =
    Boolean(fees.policy) ||
    fees.matchSubs != null ||
    fees.monthly != null ||
    fees.yearly != null ||
    fees.other != null;
  const strengthChecks = [
    Boolean(club.name.trim()),
    Boolean(club.badgeUrl),
    Boolean(club.location),
    Boolean(club.homeGround),
    Boolean(club.league),
    Boolean(club.level),
    Boolean(club.founded),
    Boolean(club.description?.trim()),
    club.trainingDays.length > 0,
    Boolean(club.trainingLocation),
    Boolean(club.matchDay),
    club.history.length > 0,
    club.achievements.length > 0,
    Boolean(club.teamPhotoUrl),
    Boolean(club.homeGroundPhotoUrl),
    Boolean(club.trainingPitchPhotoUrl),
    feeProvided,
    club.facilities.length > 0,
  ];
  return Math.round((strengthChecks.filter(Boolean).length / strengthChecks.length) * 100);
}

/**
 * Core Information: the 10 required fields a player must complete before they
 * are discoverable by clubs. Secondary positions are deliberately excluded.
 * Derived from existing columns — no separate "complete" flag is stored.
 */
export interface CoreInfoInput {
  name: string | null | undefined;
  age: number | null | undefined;
  heightInches: number | null | undefined;
  location: string | null | undefined;
  currentClub: string | null | undefined;
  levelId?: number | null | undefined;
  levelName?: string | null | undefined;
  primaryPosition: string | null | undefined;
  preferredLevelId?: number | null | undefined;
  preferredLevelName?: string | null | undefined;
  availability: string | null | undefined;
  preferredTrainingDays: readonly string[] | null | undefined;
}

export function isPlayerCoreInfoComplete(p: CoreInfoInput): boolean {
  return (
    Boolean(p.name?.trim()) &&
    typeof p.age === "number" &&
    typeof p.heightInches === "number" &&
    Boolean(p.location?.trim()) &&
    Boolean(p.currentClub?.trim()) &&
    (p.levelId != null || Boolean(p.levelName)) &&
    Boolean(p.primaryPosition) &&
    (p.preferredLevelId != null || Boolean(p.preferredLevelName)) &&
    Boolean(p.availability) &&
    (p.preferredTrainingDays?.length ?? 0) > 0
  );
}

export function playerCoreInfoComplete(p: PlayerProfileRecord): boolean {
  return isPlayerCoreInfoComplete({
    name: p.fullName,
    age: p.age,
    heightInches: p.heightInches,
    location: p.location,
    currentClub: p.currentClub,
    levelName: p.currentLevel,
    primaryPosition: p.primaryPosition,
    preferredLevelName: p.preferredLevel,
    availability: p.availability,
    preferredTrainingDays: p.preferredTrainingDays,
  });
}

/** Club Core Information: the 5 required fields before players can discover a club. */
export function isClubCoreInfoComplete(c: {
  badgePath: string | null | undefined;
  location: string | null | undefined;
  levelId?: number | null | undefined;
  levelName?: string | null | undefined;
  trainingDays: readonly string[] | null | undefined;
  matchDay: string | null | undefined;
}): boolean {
  return (
    Boolean(c.badgePath) &&
    Boolean(c.location?.trim()) &&
    (c.levelId != null || Boolean(c.levelName)) &&
    (c.trainingDays?.length ?? 0) > 0 &&
    Boolean(c.matchDay?.trim())
  );
}

export function clubCoreInfoComplete(c: ClubProfileRecord): boolean {
  return isClubCoreInfoComplete({
    badgePath: c.badgePath,
    location: c.location,
    levelName: c.level,
    trainingDays: c.trainingDays,
    matchDay: c.matchDay,
  });
}
