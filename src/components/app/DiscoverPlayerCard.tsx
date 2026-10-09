/**
 * Player card on the CLUB's Find Players page: view profile, message, save/shortlist, invite to trial, and Share.
 */
import { Link } from "@tanstack/react-router";
import { Bookmark, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvailabilityTag, Avatar, Panel, Pill } from "@/components/app/ui";
import { MessagePlayerButton } from "@/components/app/messaging/MessagePlayerButton";
import { positionLabels } from "@/lib/club-vacancies";
import type { DiscoverPlayer } from "@/lib/discover-players";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

export function DiscoverPlayerCard({
  player,
  saved,
  onToggleSaved,
}: {
  player: DiscoverPlayer;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const shareSlug = useShareSlug("player", player.id);
  const positionLine = [
    player.primaryPosition ? positionLabels[player.primaryPosition] : null,
    player.secondaryPositions.length
      ? player.secondaryPositions.map((p) => positionLabels[p]).join(" / ")
      : null,
    player.levelName,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Panel as="article" className="transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start gap-3">
        <Avatar initials={player.initials} imageUrl={player.avatarUrl} alt={`${player.name} profile photo`} className="size-12" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base uppercase"><AccountName verified={player.isVerified} owner={player.isOwner}>{player.name}</AccountName></h3>
          {positionLine ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{positionLine}</p>
          ) : null}
          <div className="mt-1.5">
            <AvailabilityTag availability={player.availability} />
          </div>
        </div>
      </div>

      {player.location || player.currentClubName || player.openToTrials ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {player.location ? (
            <Pill>
              <MapPin className="size-3" />
              {player.location}
            </Pill>
          ) : null}
          {player.currentClubName ? <Pill>{player.currentClubName}</Pill> : null}
          {player.openToTrials ? <Pill>Open to trials</Pill> : null}
        </div>
      ) : null}

      {player.lookingFor ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{player.lookingFor}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="volt" size="sm">
          <Link to="/club/players/$playerId" params={{ playerId: player.id }}>
            View profile
          </Link>
        </Button>
        <MessagePlayerButton playerId={player.id} size="sm" label="Message" />
        <Button
          variant={saved ? "voltOutline" : "subtle"}
          size="sm"
          onClick={onToggleSaved}
        >
          <Bookmark className={cn("size-4", saved && "fill-current")} />
          {saved ? "Saved player" : "Save player"}
        </Button>
        <ShareButton kind="player" slug={shareSlug} title={`${player.name} on BallFindr`} />
      </div>
    </Panel>
  );
}
