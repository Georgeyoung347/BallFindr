/**
 * Marketing-only demo player card for the homepage preview.
 */
import { MapPin } from "lucide-react";
import { availabilityLabel, type PlayerProfile } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/app/ui";
import { AccountName } from "@/components/app/AccountName";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerCard({
  player,
  className,
  compact = false,
}: {
  player: PlayerProfile;
  className?: string;
  compact?: boolean;
}) {
  return (
    <article className={cn("surface-card rounded-2xl p-4 sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials(player.name)} imageUrl={player.imageUrl} alt={`${player.name} profile photo`} className="size-12" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-extrabold tracking-tight uppercase">
            <AccountName verified={player.isVerified} owner={player.isOwner}>{player.name}</AccountName>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {player.position} • {player.level}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2.5 py-1 text-muted-foreground">
          <MapPin className="size-3" /> {player.location}
        </span>
        {player.availability === "actively_looking" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" />
            {availabilityLabel[player.availability]}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-elevated px-2.5 py-1 text-muted-foreground">
            {availabilityLabel[player.availability]}
          </span>
        )}
      </div>

      {!compact && player.stats ? (
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {player.stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-elevated/70 px-3 py-2 text-center">
              <dt className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                {s.label}
              </dt>
              <dd className="mt-1 font-display text-lg font-extrabold">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
