/**
 * Read-only display of a club's fees and facilities/benefits.
 * Both render nothing at all when the club hasn't provided the information,
 * so profiles never show large empty sections.
 */

import { Check } from "lucide-react";
import { Panel } from "@/components/app/ui";
import {
  feeLines,
  feePolicyLabels,
  hasFacilitiesInfo,
  hasFeesInfo,
  type ClubFees,
} from "@/lib/club-extras";

export function ClubFeesSection({ fees }: { fees: ClubFees | null | undefined }) {
  if (!fees || !hasFeesInfo(fees)) return null;
  const lines = feeLines(fees);
  const note =
    fees.policy === "none" || fees.policy === "varies" ? feePolicyLabels[fees.policy] : null;

  return (
    <Panel>
      <p className="eyebrow">Fees</p>
      {note ? <p className="mt-3 text-sm font-semibold">{note}</p> : null}
      {lines.length ? (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {lines.map((line) => (
            <li
              key={line.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated/50 px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{line.label}</span>
              <span className="font-display text-base font-extrabold tabular-nums">{line.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

export function ClubFacilitiesSection({
  facilities,
  facilitiesOther,
}: {
  facilities: string[] | undefined;
  facilitiesOther?: string | null | undefined;
}) {
  if (!hasFacilitiesInfo(facilities, facilitiesOther)) return null;
  const items = [...(facilities ?? [])];
  const other = facilitiesOther?.trim();
  if (other) items.push(other);

  return (
    <Panel>
      <p className="eyebrow">Facilities &amp; Benefits</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-sm"
          >
            <Check className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
