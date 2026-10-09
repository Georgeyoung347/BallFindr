/**
 * Player > own Profile: view/edit core info, bio, history, achievements, media; Share.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Eye, Pencil, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvailabilityTag,
  DetailRow,
  PageHeader,
  Panel,
  Pill,
} from "@/components/app/ui";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { ProfileFactGrid } from "@/components/profile/ProfileFactGrid";
import { PlayerHistoryTimeline } from "@/components/profile/PlayerHistoryTimeline";
import { AchievementList } from "@/components/profile/AchievementList";
import { PlayerMediaGallery } from "@/components/profile/PlayerMediaGallery";
import { PlayerMediaUploadDialog } from "@/components/profile/PlayerMediaUploadDialog";
import { PlayerMediaEditDialog } from "@/components/profile/PlayerMediaEditDialog";
import { usePlayerMedia } from "@/lib/player-media";
import { ActivitySummary } from "@/components/profile/ActivitySummary";
import { playerProfileStrength } from "@/lib/profile-completion";
import { ProfileStrength } from "@/components/profile/ProfileStrength";
import { availabilityLabels } from "@/data/app-config";
import { formatHeight, usePlayerProfileExtras, useSignedInPlayerProfile } from "@/lib/player-profile";
import { useMyApplications } from "@/lib/applications";
import { useSavedClubIds } from "@/lib/saved";
import { useMyProfileViewCount } from "@/lib/profile-views";
import { PlayerProfileEditDialog } from "@/components/profile/PlayerProfileEditDialog";
import { PlayerHistoryDialog } from "@/components/profile/PlayerHistoryDialog";
import { PlayerAchievementDialog } from "@/components/profile/PlayerAchievementDialog";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

const title = "My player profile — BallFindr";
const description =
  "Your BallFindr football CV: core details, playing history, achievements, media, recruitment preferences and activity clubs can see.";

export const Route = createFileRoute("/player/profile")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { data: p, isPending } = useSignedInPlayerProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [achievementDialog, setAchievementDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [mediaUploadOpen, setMediaUploadOpen] = useState(false);
  const [mediaEditId, setMediaEditId] = useState<string | null>(null);
  const { data: extras } = usePlayerProfileExtras();
  const { data: applications = [] } = useMyApplications();
  const { data: savedClubIds = [] } = useSavedClubIds();
  const { data: profileViewCount = 0 } = useMyProfileViewCount();
  const { data: media = [], isPending: mediaPending, error: mediaError } = usePlayerMedia(p?.id);
  const shareSlug = useShareSlug("player", p?.id);

  const trials = applications.filter((a) => a.stage === "trial").length;
  const shortlisted = applications.filter((a) =>
    ["shortlisted", "contacted"].includes(a.stage),
  ).length;

  if (isPending || !p) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My profile"
          subtitle="This is what clubs see when they find you."
          action={
            !isPending ? (
              <Button variant="volt" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit profile
              </Button>
            ) : undefined
          }
        />
        <Panel>
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "Loading your profile…"
              : "We couldn't find your profile yet. Use Edit profile to add your details."}
          </p>
        </Panel>
        <PlayerProfileEditDialog open={editOpen} onOpenChange={setEditOpen} />
      </div>
    );
  }

  const strength = playerProfileStrength(p, extras);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        subtitle="This is what clubs see when they find you."
        action={
          <div className="flex flex-wrap gap-2">
            <ShareButton kind="player" slug={shareSlug} title={`${p.fullName} on BallFindr`} />
            <Button variant="volt" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit profile
            </Button>
          </div>
        }
      />

      <Panel className="p-0">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <Avatar initials={p.initials} imageUrl={p.photoUrl} alt={`${p.fullName} profile photo`} className="size-20 rounded-2xl text-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl uppercase sm:text-3xl"><AccountName verified={p.isVerified} owner={p.isOwner}>{p.fullName}</AccountName></h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[p.primaryPosition, ...p.secondaryPositions].filter(Boolean).join(" / ")} •{" "}
              {p.currentLevel} • {p.location}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AvailabilityTag availability={p.availability} />
              <Pill tone="primary">{p.currentClub ?? "No current club"}</Pill>
              {p.recruitment.openToTrials ? <Pill tone="success">Open to trials</Pill> : null}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ProfileStrength strength={strength} />

          <ProfileSection
            title="Core information"
            action={
              <Button variant="subtle" size="sm" asChild>
                <Link to="/welcome">
                  <Plus className="size-4" /> Edit core info
                </Link>
              </Button>
            }
          >
            <ProfileFactGrid
              facts={[
                { label: "Full name", value: p.fullName },
                { label: "Age", value: p.age },
                { label: "Height", value: formatHeight(p.heightInches) },
                { label: "Location", value: p.location },
                { label: "Current club", value: p.currentClub },
                { label: "Current level / Step", value: p.currentLevel },
                { label: "Primary position", value: p.primaryPosition },
                {
                  label: "Secondary positions",
                  value: p.secondaryPositions.join(", "),
                },
                { label: "Preferred playing level", value: p.preferredLevel },
                { label: "Availability", value: availabilityLabels[p.availability] },
                {
                  label: "Preferred training days",
                  value: p.preferredTrainingDays.join(" & "),
                },
              ]}
            />
          </ProfileSection>

          <ProfileSection
            title="Player bio"
            hint="Your playing style, strengths and experience."
            action={
              <Button variant="subtle" size="sm" onClick={() => setEditOpen(true)}>
                <Plus className="size-4" /> Edit bio
              </Button>
            }
            isEmpty={!p.bio}
            emptyLabel="No bio yet"
            emptyHint="A short bio helps clubs understand your playing style."
          >
            <p className="text-sm leading-relaxed text-muted-foreground">{p.bio}</p>
          </ProfileSection>

          <ProfileSection
            title="Playing history"
            hint="Your club spells, current club first then most recent."
            action={
              <Button variant="subtle" size="sm" onClick={() => setHistoryDialog({ open: true, id: null })}>
                <Plus className="size-4" /> Add history
              </Button>
            }
            isEmpty={p.history.length === 0}
            emptyLabel="No playing history added yet"
            emptyHint="Add each club spell with level, years, position, appearances, goals and assists to build your football CV."
          >
            <PlayerHistoryTimeline
              entries={p.history}
              onEdit={(id) => setHistoryDialog({ open: true, id })}
            />
          </ProfileSection>

          <ProfileSection
            title="Achievements"
            hint="Awards, league titles, cup wins and individual honours."
            action={
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setAchievementDialog({ open: true, id: null })}
              >
                <Plus className="size-4" /> Add achievement
              </Button>
            }
            isEmpty={p.achievements.length === 0}
            emptyLabel="No achievements added yet"
            emptyHint="League titles, cup runs, player of the season and other honours will appear here."
          >
            <AchievementList
              achievements={p.achievements}
              onEdit={(id) => setAchievementDialog({ open: true, id })}
            />
          </ProfileSection>

          <ProfileSection
            title="Media"
            hint="Football photos and clips up to 15 seconds. The first item leads your gallery."
            action={
              <Button variant="subtle" size="sm" onClick={() => setMediaUploadOpen(true)}>
                <Plus className="size-4" /> Add media
              </Button>
            }
            isEmpty={!mediaPending && !mediaError && media.length === 0}
            emptyLabel="No media added yet"
            emptyHint="Add match photos and short clips so clubs can see how you play. Your profile picture stays separate."
          >
            <PlayerMediaGallery
              playerId={p.id}
              items={media}
              isPending={mediaPending}
              error={mediaError}
              canManage
              onEdit={(id) => setMediaEditId(id)}
            />
          </ProfileSection>
        </div>

        <div className="space-y-4">
          <ProfileSection title="Recruitment information">
            <div>
              <DetailRow label="Looking for" value={p.recruitment.lookingFor} />
              <DetailRow label="Preferred level" value={p.recruitment.preferredLevels.join(", ")} />
              <DetailRow
                label="Preferred positions"
                value={p.recruitment.preferredPositions.join(", ")}
              />
              <DetailRow
                label="Maximum travel"
                value={`${p.recruitment.maxTravelMiles} miles`}
              />
              <DetailRow
                label="Availability"
                value={availabilityLabels[p.recruitment.availability]}
              />
              <DetailRow
                label="Open to trials"
                value={p.recruitment.openToTrials ? "Yes" : "No"}
              />
            </div>
          </ProfileSection>

          <ProfileSection title="Activity" hint="Your live recruitment activity.">
            <ActivitySummary
              metrics={[
                { label: "Applications", value: applications.length, icon: Briefcase },
                { label: "Trials", value: trials, icon: Star },
                { label: "Shortlisted by", value: shortlisted, icon: Star },
                { label: "Saved clubs", value: savedClubIds.length, icon: Star },
              ]}
            />
          </ProfileSection>

          <Panel>
            <p className="eyebrow">Profile visibility</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-[color:var(--success)]" />
              Your profile is visible to clubs
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="size-3.5" /> {profileViewCount} profile view{profileViewCount === 1 ? "" : "s"}
            </p>
          </Panel>

        </div>
      </div>

      <PlayerProfileEditDialog open={editOpen} onOpenChange={setEditOpen} />
      <PlayerMediaUploadDialog open={mediaUploadOpen} onOpenChange={setMediaUploadOpen} />
      <PlayerMediaEditDialog
        item={media.find((m) => m.id === mediaEditId) ?? null}
        open={mediaEditId !== null}
        onOpenChange={(open) => (!open ? setMediaEditId(null) : undefined)}
      />
      <PlayerHistoryDialog
        open={historyDialog.open}
        entryId={historyDialog.id}
        onOpenChange={(open) => setHistoryDialog((s) => ({ ...s, open }))}
      />
      <PlayerAchievementDialog
        open={achievementDialog.open}
        achievementId={achievementDialog.id}
        onOpenChange={(open) => setAchievementDialog((s) => ({ ...s, open }))}
      />
    </div>
  );
}
