/** Small shared pieces for showing a trial invitation (player + club views). */

import type { ReactNode } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatTrialDate,
  formatTrialTime,
  formatTrialTimeRange,
  surfaceLabel,
  trialDisplayStatus,
  trialStatusLabels,
  trialStatusTone,
  type TrialInvite,
} from "@/lib/trial-invites";

export function TrialStatusBadge({ invite, className }: { invite: TrialInvite; className?: string }) {
  const status = trialDisplayStatus(invite);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        trialStatusTone[status],
        className,
      )}
    >
      {trialStatusLabels[status]}
    </span>
  );
}

/** Date / time / venue · surface, stacked and prominent. */
export function TrialWhenWhere({ invite, compact = false }: { invite: TrialInvite; compact?: boolean }) {
  return (
    <div className={cn("space-y-1", compact ? "text-sm" : "text-base")}>
      <p className="flex items-center gap-2 font-semibold">
        <CalendarDays className="size-4 shrink-0 text-primary" />
        {formatTrialDate(invite.trialDate)}
      </p>
      <p className="flex items-center gap-2 font-semibold">
        <Clock className="size-4 shrink-0 text-primary" />
        {formatTrialTimeRange(invite)}
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="size-4 shrink-0 text-primary" />
        {invite.venueName} · {surfaceLabel(invite.surface, invite.surfaceOther)}
      </p>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-border/70 py-3 last:border-0">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 text-sm whitespace-pre-line">{children}</div>
    </div>
  );
}

/** Full structured details — only shows optional sections that were supplied. */
export function TrialDetailsList({ invite }: { invite: TrialInvite }) {
  return (
    <div>
      <Block label="Date">{formatTrialDate(invite.trialDate)}</Block>
      <Block label="Time">
        {formatTrialTimeRange(invite)}
        {invite.arrivalTime ? (
          <span className="block text-muted-foreground">
            Please arrive by {formatTrialTime(invite.arrivalTime)}
          </span>
        ) : null}
      </Block>
      <Block label="Pitch / surface">{surfaceLabel(invite.surface, invite.surfaceOther)}</Block>
      <Block label="Venue">
        <span className="block font-semibold">{invite.venueName}</span>
        <span className="block">{invite.streetAddress}</span>
        <span className="block font-mono tracking-wide">{invite.postcode}</span>
      </Block>
      {invite.whatToBring ? <Block label="What to bring">{invite.whatToBring}</Block> : null}
      {invite.kitInstructions ? <Block label="Kit / dress">{invite.kitInstructions}</Block> : null}
      {invite.changingInfo ? <Block label="Changing rooms / showers">{invite.changingInfo}</Block> : null}
      {invite.additionalInstructions ? (
        <Block label="Additional instructions">{invite.additionalInstructions}</Block>
      ) : null}
      {invite.contactName || invite.contactPhone ? (
        <Block label="Contact on the day">
          {invite.contactName ? <span className="block">{invite.contactName}</span> : null}
          {invite.contactPhone ? (
            <a className="block text-primary underline-offset-2 hover:underline" href={`tel:${invite.contactPhone}`}>
              {invite.contactPhone}
            </a>
          ) : null}
        </Block>
      ) : null}
      {invite.notes ? <Block label="Additional notes">{invite.notes}</Block> : null}
    </div>
  );
}
