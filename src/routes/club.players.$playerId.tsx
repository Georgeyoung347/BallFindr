/**
 * Club viewing a player's profile: media, history, message, save, shortlist, invite to trial.
 */
import { isInviteActive } from "@/lib/trial-invites";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Ticket } from "lucide-react";
import { MessagePlayerButton } from "@/components/app/messaging/MessagePlayerButton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  ApplicationStageBadge,
  AvailabilityTag,
  DetailRow,
  Panel,
} from "@/components/app/ui";
import { PlayerMediaGallery } from "@/components/profile/PlayerMediaGallery";
import { MediaLightbox } from "@/components/profile/MediaLightbox";
import { usePlayerMedia, type PlayerMediaItem } from "@/lib/player-media";
import {
  applicationStageLabels,
  appliedAgo,
  useClubApplications,
  usePublicPlayerProfile,
} from "@/lib/applications";
import { primaryInviteFor, useClubTrialInvites } from "@/lib/trial-invites";
import { TrialInviteDialog } from "@/components/app/TrialInviteDialog";
import { TrialStatusBadge, TrialWhenWhere } from "@/components/app/TrialInviteBits";
import { positionLabels } from "@/lib/club-vacancies";
import { useRecordProfileView } from "@/lib/profile-views";
import { useSavedPlayerIds, useToggleSavedPlayer } from "@/lib/saved-players";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { PlayerHistoryTimeline } from "@/components/profile/PlayerHistoryTimeline";
import { AchievementList } from "@/components/profile/AchievementList";
import { formatHeight, type DbPosition } from "@/lib/player-profile";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";
import { ReportProfileButton } from "@/components/app/ReportDialog";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

export const Route = createFileRoute("/club/players/$playerId")({
  staticData: { sitemap: false },
  head: () => {
    const title = "Player profile — BallFindr";
    const description = "Player profile on BallFindr.";
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
  component: ClubPlayerProfile,
});

function BackLink() {
  return (
    <Button asChild variant="quiet" size="sm" className="-ml-2">
      <Link to="/club/applications">
        <ArrowLeft className="size-4" /> Back to applications
      </Link>
    </Button>
  );
}

function ClubPlayerProfile() {
  const { playerId } = Route.useParams();
  return <RealPlayerProfile playerId={playerId} />;
}

/** Real applicant loaded from profiles + players (never date_of_birth). */
function RealPlayerProfile({ playerId }: { playerId: string }) {
  const { data: player, isLoading, error } = usePublicPlayerProfile(playerId);
  const { data: media = [], isPending: mediaPending, error: mediaError } = usePlayerMedia(playerId);
  useRecordProfileView(playerId, "club_player_profile");
  const { data: apps } = useClubApplications();
  const { data: invites } = useClubTrialInvites();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const { data: savedIds } = useSavedPlayerIds();
  const toggleSaved = useToggleSavedPlayer();
  const saved = (savedIds ?? []).includes(playerId);

  // The most recently updated application between this club and this player.
  const application = apps?.find((a) => a.playerId === playerId);

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
  const metaLine = [ageLabel, primary, player.currentLevel, player.location].filter(Boolean).join(" • ");

  const applicationEnded =
    !application || application.stage === "rejected" || application.stage === "withdrawn";
  // Invite via the live application when there is one, otherwise a direct invite.
  const inviteApplicationId = application && !applicationEnded ? application.id : null;
  const directInvites = (invites ?? []).filter((i) => i.playerId === playerId && !i.applicationId);
  const directInvite =
    directInvites.find((i) => isInviteActive(i)) ?? directInvites[0];
  const trialInvite =
    (application ? primaryInviteFor(invites ?? [], application.id) : undefined) ?? directInvite;
  // An active (pending / accepted) invitation already exists → no second invite.
  const invited = Boolean(
    trialInvite && isInviteActive(trialInvite),
  );
  return (
    <div className="space-y-6">
      <BackLink />

      <Panel className="p-0">
        <div className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          {player.photoUrl ? (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="shrink-0 cursor-pointer rounded-2xl border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`View ${player.fullName} profile photo`}
              title="View profile photo"
            >
              <Avatar initials={player.initials} imageUrl={player.photoUrl} alt={`${player.fullName} profile photo`} className="size-16 rounded-2xl text-lg" />
            </button>
          ) : (
            <Avatar initials={player.initials} imageUrl={player.photoUrl} alt={`${player.fullName} profile photo`} className="size-16 rounded-2xl text-lg" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl uppercase sm:text-3xl"><AccountName verified={player.isVerified} owner={player.isOwner}>{player.fullName}</AccountName></h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {metaLine || "This player hasn't completed their profile yet"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <AvailabilityTag availability={player.availability} />
              {application ? <ApplicationStageBadge stage={application.stage} /> : null}
            </div>
          </div>
        </div>

        {application ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Registered interest in {application.positionLabel ?? application.vacancyTitle ?? "your vacancy"}{" "}
            {appliedAgo(application.createdAt)} · currently{" "}
            {applicationStageLabels[application.stage]}
          </p>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            This player hasn't registered interest in one of your vacancies yet.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant={saved ? "voltOutline" : "volt"}
            disabled={toggleSaved.isPending}
            onClick={() =>
              toggleSaved.mutate(
                { playerId, saved },
                {
                  onSuccess: () =>
                    toast.success(saved ? "Removed from saved players" : `${player.fullName} saved`),
                  onError: (e) =>
                    toast.error("Couldn't update saved players", {
                      description: e instanceof Error ? e.message : undefined,
                    }),
                },
              )
            }
          >
            <Bookmark className={cn("size-4", saved && "fill-current")} />
            {saved ? "Saved player" : "Save player"}
          </Button>
          <MessagePlayerButton playerId={playerId} />
          <Button
            variant={invited ? "voltOutline" : "subtle"}
            disabled={invited}
            onClick={() => setInviteOpen(true)}
          >
            <Ticket className="size-4" /> {invited ? "Trial invite sent" : "Invite to trial"}
          </Button>
          <SharePlayer playerId={playerId} name={player.fullName} />
          <ReportProfileButton profileId={playerId} name={player.fullName} />
        </div>

        {trialInvite ? (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="eyebrow">Trial invitation</p>
              <TrialStatusBadge invite={trialInvite} />
            </div>
            <div className="mt-3">
              <TrialWhenWhere invite={trialInvite} compact />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Player response:{" "}
              <span className="font-semibold text-foreground">
                {trialInvite.status === "accepted"
                  ? "Accepted"
                  : trialInvite.status === "declined"
                    ? `Declined${trialInvite.declineReason ? ` — "${trialInvite.declineReason}"` : ""}`
                    : trialInvite.status === "cancelled"
                      ? "Cancelled by you"
                      : "Not responded yet"}
              </span>
            </p>
          </div>
        ) : null}
        </div>
      </Panel>

      <TrialInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        applicationId={inviteApplicationId}
        playerId={playerId}
        playerName={player.fullName}
        vacancyLabel={inviteApplicationId ? (application?.positionLabel ?? application?.vacancyTitle) : null}
      />

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
            <p className="eyebrow">About me</p>
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
            <DetailRow label="Primary position" value={primary ?? "—"} />
            <DetailRow label="Secondary position" value={secondary.length ? secondary.join(" / ") : "—"} />
            <DetailRow label="Height" value={formatHeight(player.heightInches) ?? "—"} />
            <DetailRow label="Current club" value={player.currentClub ?? "—"} />
            <DetailRow label="Current level" value={player.currentLevel ?? "—"} />
            <DetailRow label="Preferred level" value={player.preferredLevel ?? "—"} />
            <DetailRow
              label="Max travel"
              value={player.recruitment.maxTravelMiles ? `${player.recruitment.maxTravelMiles} miles` : "—"}
            />
            <DetailRow
              label="Training days"
              value={player.preferredTrainingDays.length ? player.preferredTrainingDays.join(", ") : "—"}
            />
            <DetailRow label="Open to trials" value={player.recruitment.openToTrials ? "Yes" : "No"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SharePlayer({ playerId, name }: { playerId: string; name: string }) {
  const slug = useShareSlug("player", playerId);
  return <ShareButton kind="player" slug={slug} title={`${name} on BallFindr`} />;
}
