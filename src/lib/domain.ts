/**
 * BallFindr domain model.
 *
 * These types mirror the future database schema so UI components can be
 * swapped from demo data to real queries without changing their props.
 */

export type AccountType = "player" | "club";

export interface User {
  id: string;
  email: string;
  accountType: AccountType;
  createdAt: string;
}

export type Position =
  | "GK"
  | "RB"
  | "CB"
  | "LB"
  | "CDM"
  | "CM"
  | "CAM"
  | "RW"
  | "LW"
  | "ST";

export type Availability = "actively_looking" | "open_to_offers" | "not_looking";

export interface PlayerProfile {
  id: string;
  userId: string;
  name: string;
  position: Position;
  positionLabel: string;
  location: string;
  level: string; // e.g. "Step 7"
  availability: Availability;
  experience?: string;
  bio?: string;
  imageUrl?: string;
  videoUrl?: string;
  stats?: { label: string; value: string }[];
  isVerified?: boolean;
  isOwner?: boolean;
}

export interface Club {
  id: string;
  userId: string;
  name: string;
  location: string;
  league: string;
  level: string;
  logoUrl?: string;
  description?: string;
  isVerified?: boolean;
  isOwner?: boolean;
  isFounderClub?: boolean;
}

export type VacancyStatus = "open" | "closed";

export interface Vacancy {
  id: string;
  clubId: string;
  position: Position;
  positionLabel: string;
  level: string;
  location: string;
  description?: string;
  status: VacancyStatus;
  createdAt: string;
}

export type ApplicationStatus = "applied" | "shortlisted" | "declined" | "signed";

export interface Application {
  id: string;
  playerId: string;
  vacancyId: string;
  status: ApplicationStatus;
  createdAt: string;
}

/** A computed player↔vacancy match, produced server-side in future versions. */
export interface MatchSuggestion {
  playerId: string;
  clubId: string;
  vacancyId: string;
  score: number; // 0-100
  distanceMiles: number;
}

export const availabilityLabel: Record<Availability, string> = {
  actively_looking: "Actively looking",
  open_to_offers: "Open to offers",
  not_looking: "Not looking",
};
