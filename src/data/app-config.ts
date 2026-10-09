/**
 * Shared BallFindr configuration: domain types, option lists and display
 * labels used across the real (Supabase-backed) player and club experiences.
 *
 * This is not demo data — every value here is referenced by live features.
 */

export type Availability =
  | "immediately"
  | "pre_season"
  | "next_season"
  // Values stored in the real database.
  | "actively_looking"
  | "open_to_offers"
  | "not_looking";

export type TrainingDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

export type ApplicationStage =
  | "applied"
  | "viewed"
  | "shortlisted"
  | "trial"
  | "accepted"
  | "rejected";

export const availabilityLabels: Record<Availability, string> = {
  immediately: "Available immediately",
  pre_season: "Available pre-season",
  next_season: "Available next season",
  actively_looking: "Actively looking",
  open_to_offers: "Open to offers",
  not_looking: "Not looking",
};

export const stageLabels: Record<ApplicationStage, string> = {
  applied: "Application sent",
  viewed: "Viewed",
  shortlisted: "Shortlisted",
  trial: "Trial invited",
  accepted: "Accepted",
  rejected: "Not progressed",
};

export const applicationStages: ApplicationStage[] = [
  "applied",
  "viewed",
  "shortlisted",
  "trial",
  "accepted",
];

export const positions = ["GK", "CB", "FB", "CM", "AM", "Winger", "ST"];

export const levels = ["Step 7", "Step 8", "Step 9", "Other"];

export const playerLevels = [
  "Sunday",
  "Amateur",
  "Step 8",
  "Step 7",
  "Step 6",
  "Step 5",
  "Step 4",
  "Step 3",
  "Step 2",
  "Step 1",
];

export const trainingDayOptions: TrainingDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
