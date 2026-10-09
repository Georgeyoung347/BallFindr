/**
 * Club > own Club Profile: view and edit club details, history, achievements, badge; Share.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Pencil, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  DetailRow,
  PageHeader,
  Panel,
  ProfileCover,
  Pill,
} from "@/components/app/ui";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { ProfileFactGrid } from "@/components/profile/ProfileFactGrid";
import { ClubHistoryTimeline } from "@/components/profile/ClubHistoryTimeline";
import { AchievementList } from "@/components/profile/AchievementList";
import { ClubProfileEditDialog } from "@/components/profile/ClubProfileEditDialog";
import { ClubHistoryDialog } from "@/components/profile/ClubHistoryDialog";
import { ClubAchievementDialog } from "@/components/profile/ClubAchievementDialog";
import { ClubFacilitiesSection, ClubFeesSection } from "@/components/profile/ClubFeesFacilities";
import { clubProfileStrength } from "@/lib/profile-completion";
import { ProfileStrength } from "@/components/profile/ProfileStrength";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { useSignedInClubProfile } from "@/lib/club-profile";
import { positionLabels, useClubVacancies } from "@/lib/club-vacancies";
import { useClubApplications } from "@/lib/applications";
import { recruitmentStatusLabels } from "@/data/profile-model";
import { useShareSlug } from "@/lib/share";

const title = "Club profile — BallFindr";
const description =
  "Your public club profile on BallFindr: core details, club history, achievements, recruitment needs and current opportunities.";

export const Route = createFileRoute("/club/profile")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubProfilePage,
});

function ClubProfilePage() {
  const { data: club, isPending } = useSignedInClubProfile();
  const { data: vacancies = [] } = useClubVacancies();
  const { data: applications = [] } = useClubApplications();
  const shareSlug = useShareSlug("club", club?.id);
  const [editOpen, setEditOpen] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [achievementDialog, setAchievementDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  if (isPending || !club) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Club profile"
          subtitle="This is how players see your club."
          action={
            !isPending ? (
              <Button variant="volt" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit club profile
              </Button>
            ) : undefined
          }
        />
        <Panel>
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "Loading your club profile…"
              : "We couldn't find your club profile yet. Use Edit club profile to add your details."}
          </p>
        </Panel>
        <ClubProfileEditDialog open={editOpen} onOpenChange={setEditOpen} />
      </div>
    );
  }

  const vacancyLabel = (v: (typeof vacancies)[number]) =>
    v.title ?? v.positions.map((p) => positionLabels[p]).join(" / ");
  const open = vacancies.filter((v) => v.status === "active");
  const filled = vacancies.filter((v) => v.status === "filled");
  const applicantCount = (vacancyId: string) =>
    applications.filter((a) => a.vacancyId === vacancyId).length;

  const positionsRequired = club.recruitment.positionsRequired.length
    ? club.recruitment.positionsRequired
    : open.map(vacancyLabel);
  const positionsFilled = club.recruitment.positionsRecentlyFilled.length
    ? club.recruitment.positionsRecentlyFilled
    : filled.map(vacancyLabel);
  const dash = "—";
  const subtitleParts = [club.level, club.league, club.location].filter(Boolean).join(" • ");
  const strength = clubProfileStrength(club);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Club profile"
        subtitle="This is how players see your club."
        action={
          <div className="flex flex-wrap gap-2">
            <ShareButton kind="club" slug={shareSlug} title={`${club.name} on BallFindr`} />
            <Button variant="subtle" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit club profile
            </Button>
            <Button asChild variant="volt" size="sm">
              <Link to="/club/vacancies/new">+ Post a vacancy</Link>
            </Button>
          </div>
        }
      />
      <ClubProfileEditDialog open={editOpen} onOpenChange={setEditOpen} />
      <ClubHistoryDialog
        open={historyDialog.open}
        entryId={historyDialog.id}
        onOpenChange={(open) => setHistoryDialog((prev) => ({ ...prev, open }))}
      />
      <ClubAchievementDialog
        open={achievementDialog.open}
        achievementId={achievementDialog.id}
        onOpenChange={(open) => setAchievementDialog((prev) => ({ ...prev, open }))}
      />

      <Panel className="p-0">
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-4 p-5 sm:flex sm:flex-wrap">
          <Avatar initials={club.short} imageUrl={club.badgeUrl} alt={`${club.name} badge`} className="size-20 rounded-2xl bg-card object-contain text-lg" />
          <div className="min-w-0 flex-1">
            <h2 className="min-w-0 overflow-hidden font-display text-2xl uppercase sm:text-3xl"><AccountName verified={club.isVerified} owner={club.isOwner} founder={club.isFounderClub} className="w-full max-w-full align-bottom [&>span:first-child]:min-w-0 sm:w-auto">{club.name}</AccountName></h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subtitleParts || "Add your league, Step and location"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {club.homeGround ? (
                <Pill>
                  <MapPin className="size-3" />
                  {club.homeGround}
                </Pill>
              ) : null}
              {club.trainingDays.length ? (
                <Pill>
                  <CalendarDays className="size-3" />
                  {club.trainingDays.join(" & ")}
                </Pill>
              ) : null}
              {club.founded ? (
                <Pill>
                  <Trophy className="size-3" />
                  Founded {club.founded}
                </Pill>
              ) : null}
              <Pill tone="primary">{recruitmentStatusLabels[club.recruitment.status]}</Pill>
            </div>
          </div>
        </div>
      </Panel>

      <ProfileStrength
        strength={strength}
        hint="Complete your club details, history and achievements to reach 100%."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ProfileSection
            title="About the club"
            action={
              <Button variant="subtle" size="sm" onClick={() => setEditOpen(true)}>
                <Plus className="size-4" /> Edit about
              </Button>
            }
            isEmpty={!club.description}
            emptyLabel="No club description yet"
          >
            <p className="text-sm leading-relaxed text-muted-foreground">{club.description}</p>
          </ProfileSection>

          <ProfileSection
            title="Core information"
            action={
              <Button variant="subtle" size="sm" onClick={() => setEditOpen(true)}>
                <Plus className="size-4" /> Edit core info
              </Button>
            }
          >
            <ProfileFactGrid
              facts={[
                { label: "Club name", value: club.name },
                { label: "Location", value: club.location },
                { label: "Home ground", value: club.homeGround },
                { label: "Current league", value: club.league },
                { label: "Current Step / level", value: club.level },
                { label: "Founded", value: club.founded },
                { label: "First team", value: club.firstTeamInfo },
                { label: "Match day", value: club.matchDay },
                {
                  label: "Training",
                  value: `${club.trainingDays.join(" & ")}${club.trainingTime ? ` • ${club.trainingTime}` : ""}`,
                },
                { label: "Training location", value: club.trainingLocation },
              ]}
            />
          </ProfileSection>

          <ProfileSection
            title="Club history"
            hint="Season-by-season league record, most recent first."
            isEmpty={club.history.length === 0}
            emptyLabel="No seasons added yet"
            emptyHint="Add each season with league, Step, final position and promotion, relegation or cup outcome."
            action={
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setHistoryDialog({ open: true, id: null })}
              >
                + Add season
              </Button>
            }
          >
            <ClubHistoryTimeline
              entries={club.history}
              onEdit={(id) => setHistoryDialog({ open: true, id })}
            />
          </ProfileSection>

          <ProfileSection
            title="Club achievements"
            hint="Promotions, league titles, cup wins and major honours."
            isEmpty={club.achievements.length === 0}
            emptyLabel="No achievements added yet"
            emptyHint="Promotions and trophies will be highlighted here once added."
            action={
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setAchievementDialog({ open: true, id: null })}
              >
                + Add achievement
              </Button>
            }
          >
            <AchievementList
              achievements={club.achievements}
              onEdit={(id) => setAchievementDialog({ open: true, id })}
            />
          </ProfileSection>

          <ClubFeesSection fees={club.fees} />
          <ClubFacilitiesSection facilities={club.facilities} facilitiesOther={club.facilitiesOther} />

          <ProfileSection
            title="Current opportunities"
            hint="Live vacancies players can apply to."
            isEmpty={open.length === 0}
            emptyLabel="No open vacancies"
            emptyHint="Post a vacancy and it will appear on your public club profile."
            action={
              <Button asChild variant="subtle" size="sm">
                <Link to="/club/vacancies">Manage vacancies</Link>
              </Button>
            }
          >
            <ul className="space-y-2">
              {open.map((v) => {
                const applicants = applicantCount(v.id);
                return (
                  <li key={v.id} className="rounded-xl border border-border bg-elevated/50 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm tracking-wide text-primary uppercase">
                        {vacancyLabel(v)}
                      </span>
                      {v.levelName ? <Pill>{v.levelName}</Pill> : null}
                      <Pill tone="primary" className="ml-auto">
                        {applicants} applicant{applicants === 1 ? "" : "s"}
                      </Pill>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {v.location ? (
                        <Pill>
                          <MapPin className="size-3" />
                          {v.location}
                        </Pill>
                      ) : null}
                      {v.trainingDays.length ? (
                        <Pill>
                          <CalendarDays className="size-3" />
                          {v.trainingDays.join(" & ")}
                        </Pill>
                      ) : null}
                      {v.matchDay ? <Pill>Match day: {v.matchDay}</Pill> : null}
                      {v.trialsAvailable ? <Pill>Trials available</Pill> : null}
                    </div>
                    {v.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {v.description}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ProfileSection>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileCover imageUrl={club.teamPhotoUrl} alt={`${club.name} team`} label="Team Photo" className="h-36 rounded-xl" />
            <ProfileCover imageUrl={club.homeGroundPhotoUrl} alt={`${club.name} home ground`} label="Home Ground" className="h-36 rounded-xl" />
            <ProfileCover imageUrl={club.trainingPitchPhotoUrl} alt={`${club.name} training pitch`} label="Training Pitch" className="h-36 rounded-xl" />
          </div>
        </div>

        <div className="space-y-4">
          <ProfileSection title="Recruitment">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Positions currently required</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {positionsRequired.length ? (
                    positionsRequired.map((pos) => (
                      <Pill key={pos} tone="primary">
                        {pos}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None listed</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Positions recently filled</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {positionsFilled.length ? (
                    positionsFilled.map((pos) => <Pill key={pos}>{pos}</Pill>)
                  ) : (
                    <span className="text-sm text-muted-foreground">None yet</span>
                  )}
                </div>
              </div>
              <div>
                <DetailRow
                  label="Preferred player level"
                  value={club.recruitment.preferredPlayerLevel ?? "—"}
                />
                <DetailRow
                  label="Preferred positions"
                  value={
                    club.recruitment.preferredPositions.length
                      ? club.recruitment.preferredPositions.join(", ")
                      : positionsRequired.join(", ") || "—"
                  }
                />
                <DetailRow
                  label="Training days"
                  value={club.recruitment.trainingDays.join(" & ") || dash}
                />
                <DetailRow label="Match day" value={club.recruitment.matchDay ?? dash} />
                <DetailRow
                  label="Recruitment status"
                  value={recruitmentStatusLabels[club.recruitment.status]}
                />
              </div>
            </div>
          </ProfileSection>

          <ProfileSection title="Club information">
            <div>
              <DetailRow label="Level" value={club.level ?? dash} />
              <DetailRow label="League" value={club.league ?? dash} />
              <DetailRow label="Location" value={club.location ?? dash} />
              <DetailRow label="Training days" value={club.trainingDays.join(" & ") || dash} />
              <DetailRow label="Training location" value={club.trainingLocation ?? dash} />
              <DetailRow label="Home ground" value={club.homeGround ?? dash} />
              <DetailRow label="Founded" value={club.founded ?? dash} />
            </div>
          </ProfileSection>

          <ProfileSection
            title="Recruitment contact"
            isEmpty={!club.contactName && !club.contactEmail}
            emptyLabel="No contact added yet"
            emptyHint="Add the person handling recruitment so players know who they are speaking to."
          >
            <div>
              <DetailRow label="Contact" value={club.contactName ?? dash} />
              <DetailRow label="Role" value={club.contactRole ?? dash} />
              <DetailRow label="Email" value={club.contactEmail ?? dash} />
            </div>
          </ProfileSection>

        </div>
      </div>
    </div>
  );
}
