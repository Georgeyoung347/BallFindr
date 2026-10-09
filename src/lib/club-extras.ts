/**
 * Club fees and facilities/benefits.
 *
 * Both live on the existing `clubs` row (fees_policy, match_subs_fee,
 * monthly_fee, yearly_fee, other_fee, other_fee_label, facilities,
 * facilities_other) — no separate tables. Shared here so the owner's club
 * profile, the edit dialog and the public club profile all read one shape.
 */

export const feePolicies = ["listed", "none", "varies"] as const;
export type FeePolicy = (typeof feePolicies)[number];

export const feePolicyLabels: Record<FeePolicy, string> = {
  listed: "Fees listed below",
  none: "No fees",
  varies: "Fees vary / contact club",
};

export interface ClubFees {
  policy: FeePolicy | null;
  matchSubs: number | null;
  monthly: number | null;
  yearly: number | null;
  other: number | null;
  otherLabel: string | null;
}

export function emptyClubFees(): ClubFees {
  return { policy: null, matchSubs: null, monthly: null, yearly: null, other: null, otherLabel: null };
}

export const facilityOptions = [
  "Physio",
  "Training Kit",
  "Match Kit",
  "Training Facilities",
  "Gym",
  "Strength & Conditioning",
  "Goalkeeper Coach",
  "Sports Therapist",
  "Medical Support",
] as const;

export function toFeePolicy(value: unknown): FeePolicy | null {
  return (feePolicies as readonly string[]).includes(value as string) ? (value as FeePolicy) : null;
}

export function toAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatGbp(amount: number): string {
  return Number.isInteger(amount) ? `£${amount}` : `£${amount.toFixed(2)}`;
}

/** The fee lines a club has actually filled in. */
export function feeLines(fees: ClubFees): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (fees.matchSubs !== null) lines.push({ label: "Match Subs", value: formatGbp(fees.matchSubs) });
  if (fees.monthly !== null) lines.push({ label: "Monthly Fee", value: formatGbp(fees.monthly) });
  if (fees.yearly !== null) lines.push({ label: "Yearly Fee", value: formatGbp(fees.yearly) });
  if (fees.other !== null)
    lines.push({ label: fees.otherLabel?.trim() || "Other Fee", value: formatGbp(fees.other) });
  return lines;
}

export function hasFeesInfo(fees: ClubFees | undefined | null): boolean {
  if (!fees) return false;
  if (fees.policy === "none" || fees.policy === "varies") return true;
  return feeLines(fees).length > 0;
}

export function hasFacilitiesInfo(
  items: string[] | undefined,
  other?: string | null | undefined,
): boolean {
  return Boolean((items && items.length) || other?.trim());
}
