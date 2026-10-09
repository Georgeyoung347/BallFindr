/**
 * Shared read-only club profile layout used when players/clubs view a club (player.clubs.$clubId, club.clubs.$clubId). Shows details, history, achievements, vacancies and Share.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, CalendarDays, Check, MapPin, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ApplicationStageBadge,
  DetailRow,
  Panel,
  ProfileCover,
  Avatar,
  Pill,
} from "@/components/app/ui";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { ClubHistoryTimeline } from "@/components/profile/ClubHistoryTimeline";
import { AchievementList } from "@/components/profile/AchievementList";
import { ClubFacilitiesSection, ClubFeesSection } from "@/components/profile/ClubFeesFacilities";
import { canWithdrawApplication, useApplyToVacancy, useMyApplications } from "@/lib/applications";
import { WithdrawInterestButton } from "@/components/app/WithdrawInterestButton";
import { useClubCv } from "@/lib/club-cv";
import { postedAgo, useClubDetail, useVacancyById } from "@/lib/discover-clubs";
import { useRecordProfileView } from "@/lib/profile-views";
import {
  useSavedClubIds,
  useSavedVacancyIds,
  useToggleSavedClub,
  useToggleSavedVacancy,
} from "@/lib/saved";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";
import { ReportProfileButton } from "@/components/app/ReportDialog";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

function BackLink({ readOnly }: { readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <Button asChild variant="quiet" size="sm" className="-ml-2">
      <Link to="/player/find-clubs">
        <ArrowLeft className="size-4" /> Back to search
      </Link>
    </Button>
  );
}

/**
 * "I'm Interested" for one real vacancy. Reads the player's own applications
 * so an existing row shows its current stage instead of offering to re-apply.
 */
function InterestAction({ vacancyId, clubId }: { vacancyId: string; clubId: string }) {
  // The applications list only decorates an existing application with its stage.
  // It must not block the button: the submit itself re-checks for duplicates.
  const { data: apps } = useMyApplications();
  const apply = useApplyToVacancy();
  const found = apps?.find((a) => a.vacancyId === vacancyId);
  // A withdrawn application counts as "not applied" so the player can re-register interest.
  const existing = found && found.stage !== "withdrawn" ? found : undefined;
  const justSent = apply.isSuccess;

  if (existing || justSent) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="voltOutline" disabled>
          <Check className="size-4" /> Interest sent
        </Button>
        {existing ? <ApplicationStageBadge stage={existing.stage} /> : null}
        <Button asChild variant="quiet" size="sm">
          <Link to="/player/applications">Track application</Link>
        </Button>
        {existing && canWithdrawApplication(existing.stage) ? (
          <WithdrawInterestButton applicationId={existing.id} onWithdrawn={() => apply.reset()} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Button
        variant="volt"
        disabled={apply.isPending}
        onClick={() =>
          apply.mutate(
            { vacancyId, clubId },
            {
              onSuccess: (res) =>
                res.created
                  ? toast.success("Interest sent to the club", {
                      description: "Track its progress on your applications page.",
                    })
                  : toast("You've already registered interest in this vacancy."),
              onError: (e) =>
                toast.error("Couldn't send your interest", {
                  description: e instanceof Error ? e.message : undefined,
                }),
            },
          )
        }
      >
        <Send className="size-4" /> {apply.isPending ? "Sending…" : "I'm Interested"}
      </Button>
    </div>
  );
}

/** Saves the club profile itself to saved_clubs. */
function SaveClubButton({ clubId }: { clubId: string }) {
  const { data: savedIds = [] } = useSavedClubIds();
  const toggle = useToggleSavedClub();
  const saved = savedIds.includes(clubId);
  return (
    <Button
      variant={saved ? "voltOutline" : "subtle"}
      size="sm"
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ clubId, saved })}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
      {saved ? "Saved club" : "Save club"}
    </Button>
  );
}

/** Saves one specific vacancy to saved_vacancies. */
function SaveOpportunityButton({ vacancyId }: { vacancyId: string }) {
  const { data: savedIds = [] } = useSavedVacancyIds();
  const toggle = useToggleSavedVacancy();
  const saved = savedIds.includes(vacancyId);
  return (
    <Button
      variant={saved ? "voltOutline" : "subtle"}
      size="sm"
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ vacancyId, saved })}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
      {saved ? "Saved opportunity" : "Save opportunity"}
    </Button>
  );
}

/** Shared public club profile. readOnly hides player-only actions (apply/save). */
export function ClubProfileView({ clubId, vacancyId, readOnly = false }: { clubId: string; vacancyId?: string | undefined; readOnly?: boolean }) {
  const { data, isLoading, error } = useClubDetail(clubId);
  const { data: lookup } = useVacancyById(vacancyId ?? "", Boolean(vacancyId));
  const { data: cv } = useClubCv(clubId);
  useRecordProfileView(readOnly ? undefined : clubId, "player_club_profile");
  const clubSlug = useShareSlug("club", clubId);
  const vacancySlug = useShareSlug("vacancy", vacancyId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink readOnly={readOnly} />
        <Panel className="text-sm text-muted-foreground">Loading club…</Panel>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <BackLink readOnly={readOnly} />
        <Panel className="text-sm text-muted-foreground">
          This club is no longer available. It may have been removed, or the opportunity has closed.
        </Panel>
      </div>
    );
  }

  const { club, vacancies } = data;
  const selected = vacancyId ? vacancies.find((v) => v.id === vacancyId) : undefined;
  const closedSelection = Boolean(vacancyId && !selected);
  const metaLine = [club.levelName, club.league, club.location].filter(Boolean).join(" • ");

  return (
    <div className="space-y-6">
      <BackLink readOnly={readOnly} />

      <Panel className="p-0">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-3 p-4 sm:gap-x-4 sm:p-5">
          <Avatar initials={club.short} imageUrl={club.badgeUrl} alt={`${club.name} badge`} className="size-16 shrink-0 rounded-2xl bg-card object-contain text-lg sm:size-20" />
          <div className="min-w-0 flex-1 basis-40 sm:basis-0">
            <h1 className="font-display text-2xl uppercase break-words sm:text-3xl"><AccountName truncate={false} className="flex-wrap" verified={club.isVerified} owner={club.isOwner} founder={club.isFounderClub}>{club.name}</AccountName></h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {metaLine || "Club details coming soon"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {club.location ? (
                <Pill>
                  <MapPin className="size-3" />
                  {club.location}
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
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            {readOnly ? null : <SaveClubButton clubId={club.id} />}
            {vacancySlug && selected ? (
              <ShareButton kind="vacancy" slug={vacancySlug} title={`Opportunity at ${club.name}`} />
            ) : (
              <ShareButton kind="club" slug={clubSlug} title={`${club.name} on BallFindr`} />
            )}
            <ReportProfileButton profileId={club.id} name={club.name} />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel>
            <p className="eyebrow">About the club</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {club.description ?? "This club hasn't added a description yet."}
            </p>
          </Panel>

          <ProfileSection
            title="Club history"
            hint="Season-by-season league record, most recent first."
            isEmpty={(cv?.history.length ?? 0) === 0}
            emptyLabel="No seasons added yet"
            emptyHint="This club hasn't added its season history yet."
          >
            <ClubHistoryTimeline entries={cv?.history ?? []} />
          </ProfileSection>

          <ProfileSection
            title="Club achievements"
            hint="Promotions, league titles, cup wins and major honours."
            isEmpty={(cv?.achievements.length ?? 0) === 0}
            emptyLabel="No achievements added yet"
            emptyHint="This club hasn't added any honours yet."
          >
            <AchievementList achievements={cv?.achievements ?? []} />
          </ProfileSection>

          <ClubFeesSection fees={club.fees} />
          <ClubFacilitiesSection facilities={club.facilities} facilitiesOther={club.facilitiesOther} />

          {closedSelection ? (
            <Panel className="border-border/70 bg-elevated/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg tracking-wide text-muted-foreground uppercase">
                    {lookup?.vacancy.positionLabel ?? lookup?.vacancy.title ?? "Opportunity"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[lookup?.vacancy.levelName, lookup?.vacancy.location]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </div>
                <Pill>Opportunity closed</Pill>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This vacancy is no longer available. The club is no longer recruiting for this
                position, so you can't apply to it. Any other current openings are listed below.
              </p>
              {readOnly ? null : (
                <div className="mt-4">
                  <SaveOpportunityButton vacancyId={vacancyId!} />
                </div>
              )}
            </Panel>
          ) : null}

          <div>
            <p className="eyebrow">Current opportunities</p>
            <div className="mt-3 space-y-3">
              {vacancies.map((v) => (
                <Panel
                  key={v.id}
                  className={cn(selected?.id === v.id && "border-primary/40 bg-primary/[0.04]")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg tracking-wide text-primary uppercase">
                        {v.positionLabel ?? v.title ?? "Vacancy"}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[v.title, v.levelName, v.location].filter(Boolean).join(" • ") ||
                          "Open opportunity"}
                      </p>
                    </div>
                    <Pill tone="primary">Active</Pill>
                  </div>
                  {v.description ? (
                    <p className="mt-3 text-sm text-muted-foreground">{v.description}</p>
                  ) : null}
                  {v.requirements ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">What they're after: </span>
                      {v.requirements}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {v.trainingDays.length ? (
                      <Pill>
                        <CalendarDays className="size-3" />
                        {v.trainingDays.join(" & ")}
                      </Pill>
                    ) : null}
                    {v.matchDay ? <Pill>Matchday {v.matchDay}</Pill> : null}
                    {v.trialsAvailable ? <Pill>Trials available</Pill> : null}
                    <Pill>Posted {postedAgo(v.createdAt)}</Pill>
                  </div>
                  {readOnly ? null : <div className="flex flex-wrap items-center gap-3">
                    <InterestAction vacancyId={v.id} clubId={club.id} />
                    <div className="mt-4">
                      <SaveOpportunityButton vacancyId={v.id} />
                    </div>
                  </div>}
                </Panel>
              ))}
              {vacancies.length === 0 ? (
                <Panel className="text-sm text-muted-foreground">
                  No open vacancies right now — check back soon.
                </Panel>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileCover imageUrl={club.teamPhotoUrl} alt={`${club.name} team`} label="Team Photo" className="h-36 rounded-xl" />
            <ProfileCover imageUrl={club.homeGroundPhotoUrl} alt={`${club.name} home ground`} label="Home Ground" className="h-36 rounded-xl" />
            <ProfileCover imageUrl={club.trainingPitchPhotoUrl} alt={`${club.name} training pitch`} label="Training Pitch" className="h-36 rounded-xl" />
          </div>
        </div>

        <Panel className="h-fit">
          <p className="eyebrow">Club information</p>
          <div className="mt-3">
            <DetailRow label="Level" value={club.levelName ?? "—"} />
            <DetailRow label="League" value={club.league ?? "—"} />
            <DetailRow label="Location" value={club.location ?? "—"} />
            <DetailRow
              label="Training days"
              value={club.trainingDays.length ? club.trainingDays.join(" & ") : "—"}
            />
            <DetailRow label="Training location" value={club.trainingLocation ?? "—"} />
            <DetailRow label="Home ground" value={club.homeGround ?? "—"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
