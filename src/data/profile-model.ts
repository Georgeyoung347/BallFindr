/**
 * BallFindr profile schema.
 *
 * These types describe the full Player Profile and Club Profile records the
 * product will eventually load from the database. Components read from these
 * shapes only, so swapping the demo records below for real rows requires no
 * UI changes. Sections are intentionally driven by arrays that may be empty —
 * empty means "no records yet", not "hide the capability".
 */

import type { Availability, TrainingDay } from "@/data/app-config";
import type { ClubFees } from "@/lib/club-extras";

export type AchievementKind =
  | "award"
  | "league_title"
  | "cup"
  | "individual"
  | "promotion"
  | "relegation"
  | "other";

export const achievementKindLabels: Record<AchievementKind, string> = {
  award: "Award",
  league_title: "League title",
  cup: "Cup",
  individual: "Individual",
  promotion: "Promotion",
  relegation: "Relegation",
  other: "Achievement",
};

export interface Achievement {
  id: string;
  kind: AchievementKind;
  title: string;
  season?: string;
  club?: string;
  detail?: string;
}

/** Player photos/clips live in `@/lib/player-media` (media table + player-media bucket). */


/** One season of a player's career. */
export interface PlayerHistoryEntry {
  id: string;
  season: string;
  club: string;
  level: string;
  league?: string;
  position?: string;
  appearances?: number;
  goals?: number;
  assists?: number;
  /** Goalkeeper entries use these instead of goals/assists. */
  cleanSheets?: number;
  goalsAgainst?: number;
  notes?: string;
  /** How this season followed the previous one — drives the timeline connector. */
  transition?: "promotion" | "move" | "relegation" | "stayed";
  /** Ongoing spell — the player's current club. */
  isCurrent?: boolean;
}

export interface PlayerRecruitment {
  lookingFor: string;
  preferredLevels: string[];
  preferredPositions: string[];
  maxTravelMiles: number;
  availability: Availability;
  openToTrials: boolean;
}

export interface PlayerProfileRecord {
  id: string;
  fullName: string;
  isVerified: boolean;
  isOwner: boolean;
  initials: string;
  photoUrl?: string;
  photoPath?: string;
  coverUrl?: string;
  coverPath?: string;
  age?: number;
  /** Optional height stored as total inches. */
  heightInches?: number;
  location?: string;
  currentClub?: string;
  currentLevel?: string;
  primaryPosition?: string;
  secondaryPositions: string[];
  preferredLevel?: string;
  availability: Availability;
  preferredTrainingDays: TrainingDay[];
  bio?: string;
  history: PlayerHistoryEntry[];
  achievements: Achievement[];
  
  recruitment: PlayerRecruitment;
}

/** One season of a club's league record. */
export interface ClubHistoryEntry {
  id: string;
  season: string;
  league: string;
  level: string;
  finalPosition?: string;
  outcome?: "promoted" | "relegated" | "champions" | "none";
  cupAchievement?: string;
  notes?: string;
  wins?: number;
  draws?: number;
  losses?: number;
}

export type RecruitmentStatus = "actively_recruiting" | "selective" | "closed";

export const recruitmentStatusLabels: Record<RecruitmentStatus, string> = {
  actively_recruiting: "Actively recruiting",
  selective: "Selectively recruiting",
  closed: "Not recruiting",
};

export interface ClubRecruitment {
  status: RecruitmentStatus;
  positionsRequired: string[];
  positionsRecentlyFilled: string[];
  preferredPlayerLevel?: string;
  preferredPositions: string[];
  trainingDays: TrainingDay[];
  matchDay?: string;
}

export interface ClubProfileRecord {
  id: string;
  name: string;
  isVerified: boolean;
  isOwner: boolean;
  isFounderClub: boolean;
  short: string;
  badgeUrl?: string;
  badgePath?: string;
  teamPhotoUrl?: string;
  teamPhotoPath?: string;
  homeGroundPhotoUrl?: string;
  homeGroundPhotoPath?: string;
  trainingPitchPhotoUrl?: string;
  trainingPitchPhotoPath?: string;
  location?: string;
  homeGround?: string;
  league?: string;
  level?: string;
  founded?: string;
  firstTeamInfo?: string;
  description?: string;
  trainingDays: TrainingDay[];
  trainingLocation?: string;
  trainingTime?: string;
  matchDay?: string;
  matchInfo?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  fees: ClubFees;
  facilities: string[];
  facilitiesOther?: string;
  history: ClubHistoryEntry[];
  achievements: Achievement[];
  recruitment: ClubRecruitment;
}
