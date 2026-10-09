/**
 * Player viewing another player's profile; Share and Report.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvailabilityTag, Avatar, DetailRow, Panel } from "@/components/app/ui";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { PlayerMediaGallery } from "@/components/profile/PlayerMediaGallery";
import { MediaLightbox } from "@/components/profile/MediaLightbox";
import { PlayerHistoryTimeline } from "@/components/profile/PlayerHistoryTimeline";
import { AchievementList } from "@/components/profile/AchievementList";
import { usePlayerMedia, type PlayerMediaItem } from "@/lib/player-media";
import { usePublicPlayerProfile } from "@/lib/applications";
import { useRecordProfileView } from "@/lib/profile-views";
import { positionLabels } from "@/lib/club-vacancies";
import { formatHeight, type DbPosition } from "@/lib/player-profile";
import { AccountName } from "@/components/app/AccountName";
import { ReportProfileButton } from "@/components/app/ReportDialog";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

export const Route = createFileRoute("/player/players/$playerId")({
  staticData: { sitemap: false },
  head: () => {
    const title = "Player profile — BallFindr";
    const description = "View another registered player's public recruitment profile on BallFindr.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: PlayerViewPlayerProfile,
});

function BackLink() {
  return (
    <Button asChild variant="quiet" size="sm" className="-ml-2">
      <Link to="/player/find-players">
        <ArrowLeft className="size-4" /> Back to players
      </Link>
    </Button>
  );
}

/**
 * Player-to-player profile view: strictly read-only. It reuses the existing
 * public player profile loader (which never selects date_of_birth) and the
 * existing media gallery / lightbox. No messaging, saving, shortlisting or
 * trial-invite actions are rendered — those remain club-only.
 */
function PlayerViewPlayerProfile() {
  const { playerId } = Route.useParams();
  const { data: player, isLoading, error } = usePublicPlayerProfile(playerId);
  const { data: media = [], isPending: mediaPending, error: mediaError } = usePlayerMedia(playerId);
  const [photoOpen, setPhotoOpen] = useState(false);
  const shareSlug = useShareSlug("player", playerId);
  useRecordProfileView(playerId, "player_player_profile");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Panel className="text-sm text-muted-foreground">Loading player…</Panel>
      </div>
    );
  }
  if (error || !player) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Panel className="text-sm text-muted-foreground">
          Player not found — this profile may have been removed, or the link is invalid.
        </Panel>
      </div>
    );
  }

  const label = (code: string | undefined) =>
    code ? (positionLabels[code as DbPosition] ?? code) : undefined;
  const primary = label(player.primaryPosition);
  const secondary = player.secondaryPositions.map((p) => label(p) ?? p);
  const ageLabel = player.age ? `${player.age} years old` : undefined;
  const metaLine = [ageLabel, primary, player.currentLevel, player.location]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="space-y-6">
      <BackLink />

      <Panel>
        <div className="flex flex-wrap items-start gap-4">
          {player.photoUrl ? (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="shrink-0 cursor-pointer rounded-2xl border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`View ${player.fullName} profile photo`}
              title="View profile photo"
            >
              <Avatar
                initials={player.initials}
                imageUrl={player.photoUrl}
                alt={`${player.fullName} profile photo`}
                className="size-16 rounded-2xl text-lg"
              />
            </button>
          ) : (
            <Avatar
              initials={player.initials}
              alt={`${player.fullName} profile photo`}
              className="size-16 rounded-2xl text-lg"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl uppercase sm:text-3xl"><AccountName verified={player.isVerified} owner={player.isOwner}>{player.fullName}</AccountName></h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {metaLine || "This player hasn't completed their profile yet"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <AvailabilityTag availability={player.availability} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ShareButton kind="player" slug={shareSlug} title={`${player.fullName} on BallFindr`} />
              <ReportProfileButton profileId={playerId} name={player.fullName} />
            </div>
          </div>
        </div>
      </Panel>

      {player.photoUrl ? (
        <MediaLightbox
          items={[
            {
              id: "profile-photo",
              ownerId: playerId,
              kind: "photo",
              title: player.fullName,
              caption: null,
              url: player.photoUrl,
              sortOrder: 0,
              durationSeconds: null,
              width: null,
              height: null,
              createdAt: new Date().toISOString(),
            } satisfies PlayerMediaItem,
          ]}
          index={photoOpen ? 0 : null}
          onIndexChange={() => {}}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel>
            <p className="eyebrow">About</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {player.bio ?? "This player hasn't written a bio yet."}
            </p>
            {player.recruitment.lookingFor ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Looking for: </span>
                {player.recruitment.lookingFor}
              </p>
            ) : null}
          </Panel>

          <ProfileSection
            title="Media"
            hint="Photos and short clips shared by the player. Click any item to view it full screen."
            isEmpty={!mediaPending && !mediaError && media.length === 0}
            emptyLabel="No media added yet"
            emptyHint="This player hasn't shared any photos or clips."
          >
            <PlayerMediaGallery
              playerId={playerId}
              items={media}
              isPending={mediaPending}
              error={mediaError}
            />
          </ProfileSection>

          <ProfileSection
            title="Playing history"
            hint="Season-by-season progression, most recent first."
            isEmpty={player.history.length === 0}
            emptyLabel="No playing history added yet"
            emptyHint="This player hasn't added any seasons to their profile."
          >
            <PlayerHistoryTimeline entries={player.history} />
          </ProfileSection>

          <ProfileSection
            title="Achievements"
            hint="Awards, league titles, cup wins and individual honours."
            isEmpty={player.achievements.length === 0}
            emptyLabel="No achievements added yet"
            emptyHint="This player hasn't added any honours to their profile."
          >
            <AchievementList achievements={player.achievements} />
          </ProfileSection>
        </div>

        <Panel className="h-fit">
          <p className="eyebrow">Playing information</p>
          <div className="mt-3">
            <DetailRow label="Age" value={player.age ? `${player.age}` : "—"} />
            <DetailRow label="Primary position" value={primary ?? "—"} />
            <DetailRow
              label="Secondary position"
              value={secondary.length ? secondary.join(" / ") : "—"}
            />
            <DetailRow label="Height" value={formatHeight(player.heightInches) ?? "—"} />
            <DetailRow label="Location" value={player.location ?? "—"} />
            <DetailRow label="Current club" value={player.currentClub ?? "—"} />
            <DetailRow label="Current level" value={player.currentLevel ?? "—"} />
            <DetailRow label="Preferred level" value={player.preferredLevel ?? "—"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
