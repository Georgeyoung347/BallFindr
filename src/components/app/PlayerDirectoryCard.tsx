/**
 * Player card on the PLAYER's Find Players page (player-to-player browsing): view profile and Share.
 */
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvailabilityTag, Avatar, Panel, Pill } from "@/components/app/ui";
import { positionLabels } from "@/lib/club-vacancies";
import { formatHeight } from "@/lib/player-profile";
import type { DiscoverPlayer } from "@/lib/discover-players";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

/**
 * Player-side directory card: view-only. No saving, messaging, shortlisting or
 * trial invites — those remain club-only features.
 */
export function PlayerDirectoryCard({ player }: { player: DiscoverPlayer }) {
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

  const height = formatHeight(player.heightInches);
  const summary = player.lookingFor ?? player.bio;

  return (
    <Panel as="article" className="transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start gap-3">
        <Avatar
          initials={player.initials}
          imageUrl={player.avatarUrl}
          alt={`${player.name} profile photo`}
          className="size-12"
        />
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {player.age ? <Pill>{player.age} years old</Pill> : null}
        {height ? <Pill>{height}</Pill> : null}
        {player.location ? (
          <Pill>
            <MapPin className="size-3" />
            {player.location}
          </Pill>
        ) : null}
        {player.currentClubName ? <Pill>{player.currentClubName}</Pill> : null}
        {player.preferredLevelName ? <Pill>Wants {player.preferredLevelName}</Pill> : null}
      </div>

      {summary ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{summary}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="volt" size="sm">
          <Link to="/player/players/$playerId" params={{ playerId: player.id }}>
            View profile
          </Link>
        </Button>
        <ShareButton kind="player" slug={shareSlug} title={`${player.name} on BallFindr`} />
      </div>
    </Panel>
  );
}
