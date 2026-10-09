/**
 * Card for one club/vacancy on the player's Find Clubs page: club info, I'm Interested (applications), save club, and a per-card Share button.
 */
import { Link } from "@tanstack/react-router";
import { Bookmark, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Panel, Pill } from "@/components/app/ui";
import { postedAgo, type DiscoverClub, type DiscoverVacancy } from "@/lib/discover-clubs";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

export function ClubOpportunityCard({
  club,
  vacancy,
  saved = false,
  onToggleSave,
  saveClub = false,
}: {
  club: DiscoverClub;
  vacancy?: DiscoverVacancy | null;
  /** Saved state of the target: the opportunity (saved_vacancies) when a vacancy
   * is present, otherwise the club itself (saved_clubs). */
  saved?: boolean;
  onToggleSave?: (() => void) | undefined;
  /** Force the save button to target the club even when a vacancy is shown. */
  saveClub?: boolean;
}) {
  const shareSlug = useShareSlug("club", club.id);
  const metaLine = [club.levelName, club.league, club.location].filter(Boolean).join(" • ");
  const trainingDays = vacancy?.trainingDays.length ? vacancy.trainingDays : club.trainingDays;

  return (
    <Panel as="article" className="transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start gap-3">
        <Avatar initials={club.short} imageUrl={club.badgeUrl} alt={`${club.name} badge`} className="size-12 object-contain text-xs" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base uppercase"><AccountName verified={club.isVerified} owner={club.isOwner} founder={club.isFounderClub}>{club.name}</AccountName></h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {metaLine || "Club details coming soon"}
          </p>
        </div>
        {onToggleSave ? (
          <button
            type="button"
            onClick={onToggleSave}
            aria-label={
              vacancy && !saveClub
                ? saved
                  ? "Remove saved opportunity"
                  : "Save opportunity"
                : saved
                  ? "Remove saved club"
                  : "Save club"
            }
            title={
              vacancy && !saveClub
                ? saved
                  ? "Saved opportunity"
                  : "Save opportunity"
                : saved
                  ? "Saved club"
                  : "Save club"
            }
            aria-pressed={saved}
            className={cn(
              "grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-border transition-colors",
              saved ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Bookmark className={cn("size-4", saved && "fill-current")} />
          </button>
        ) : null}
      </div>

      {vacancy ? (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
          <p className="font-display text-sm font-extrabold tracking-wide text-primary uppercase">
            {vacancy.positionLabel ?? vacancy.title ?? "Vacancy"}
          </p>
          {vacancy.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{vacancy.description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {vacancy?.location || club.location ? (
          <Pill>
            <MapPin className="size-3" />
            {vacancy?.location || club.location}
          </Pill>
        ) : null}
        {trainingDays.length ? (
          <Pill>
            <CalendarDays className="size-3" />
            {trainingDays.join(" & ")}
          </Pill>
        ) : null}
        {vacancy?.trialsAvailable ? <Pill>Trials available</Pill> : null}
        {vacancy ? <Pill>Posted {postedAgo(vacancy.createdAt)}</Pill> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="volt" size="sm">
          <Link
            to="/player/clubs/$clubId"
            params={{ clubId: club.id }}
            search={vacancy ? { vacancy: vacancy.id } : {}}
          >
            {vacancy ? "View opportunity" : "View club"}
          </Link>
        </Button>
        <ShareButton kind="club" slug={shareSlug} title={`${club.name} on BallFindr`} />
      </div>
    </Panel>
  );
}
