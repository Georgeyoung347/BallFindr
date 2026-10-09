/**
 * Marketing-only demo club card for the homepage preview.
 */
import { MapPin } from "lucide-react";
import type { Club } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/app/ui";
import { AccountName } from "@/components/app/AccountName";

export function ClubCard({
  club,
  distanceMiles,
  lookingFor,
  className,
}: {
  club: Club;
  distanceMiles?: number;
  lookingFor?: string;
  className?: string;
}) {
  const initials = club.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
  return (
    <article className={cn("surface-card rounded-2xl p-4 sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials} imageUrl={club.logoUrl} alt={`${club.name} badge`} className="size-12 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-extrabold tracking-tight uppercase">
            <AccountName verified={club.isVerified} owner={club.isOwner} founder={club.isFounderClub}>{club.name}</AccountName>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{club.level}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2.5 py-1 text-muted-foreground">
          <MapPin className="size-3" />
          {distanceMiles !== undefined ? `${distanceMiles} miles away` : club.location}
        </span>
        {lookingFor ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary">
            Looking for: {lookingFor}
          </span>
        ) : null}
      </div>
    </article>
  );
}
