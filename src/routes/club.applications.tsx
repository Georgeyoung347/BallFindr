/**
 * Club > Applications: players who applied to the club's vacancies; change status, invite to trial.
 */
import { isInviteActive } from "@/lib/trial-invites";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ApplicationStageBadge,
  Avatar,
  EmptyState,
  FilterChip,
  PageHeader,
  Panel,
} from "@/components/app/ui";
import {
  applicationStageLabels,
  appliedAgo,
  clubStageOptions,
  useClubApplications,
  useSetApplicationStage,
  type ApplicationStage,
  type ClubApplication,
} from "@/lib/applications";
import { primaryInviteFor, useCancelTrialInvite, useClubTrialInvites } from "@/lib/trial-invites";
import { TrialInviteDialog } from "@/components/app/TrialInviteDialog";
import { TrialStatusBadge, TrialWhenWhere } from "@/components/app/TrialInviteBits";
import { cn } from "@/lib/utils";
import { useHashHighlight } from "@/lib/use-hash-highlight";
import { AccountName } from "@/components/app/AccountName";

const title = "Applications — BallFindr club";
const description =
  "Review every player who has applied to your vacancies and move them through reviewing, shortlisted, trial and accepted.";

export const Route = createFileRoute("/club/applications")({
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
  component: ClubApplications,
});

const filterOptions: ApplicationStage[] = ["interested", ...clubStageOptions];

function ClubApplications() {
  const { data, isLoading, error } = useClubApplications();
  const { data: invites = [] } = useClubTrialInvites();
  const setStage = useSetApplicationStage();
  const cancelInvite = useCancelTrialInvite();
  const [stageFilter, setStageFilter] = useState<ApplicationStage | null>(null);
  const [inviteFor, setInviteFor] = useState<ClubApplication | null>(null);

  const apps = data ?? [];
  useHashHighlight("application-", apps.map((a) => a.id).join(","));

  // Group by vacancy, preserving newest-first order of first appearance.
  const groups = new Map<string, { label: string; apps: ClubApplication[] }>();
  for (const a of apps) {
    if (stageFilter && a.stage !== stageFilter) continue;
    const g = groups.get(a.vacancyId) ?? {
      label: a.positionLabel ?? a.vacancyTitle ?? "Vacancy",
      apps: [],
    };
    g.apps.push(a);
    groups.set(a.vacancyId, g);
  }
  const grouped = [...groups.entries()];

  const move = (a: ClubApplication, stage: ApplicationStage, message: string) => {
    if (a.stage === stage) return;
    setStage.mutate(
      { id: a.id, stage },
      {
        onSuccess: () => toast.success(message),
        onError: (e) =>
          toast.error("Couldn't update application", {
            description: e instanceof Error ? e.message : undefined,
          }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" subtitle="Players who have applied to your vacancies." />

      <div className="flex flex-wrap gap-2">
        <FilterChip active={stageFilter === null} onClick={() => setStageFilter(null)}>
          All
        </FilterChip>
        {filterOptions.map((s) => (
          <FilterChip
            key={s}
            active={stageFilter === s}
            onClick={() => setStageFilter(stageFilter === s ? null : s)}
          >
            {s === "interested" ? "New interest" : applicationStageLabels[s]}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <Panel className="text-sm text-muted-foreground">Loading applications…</Panel>
      ) : error ? (
        <Panel className="text-sm text-muted-foreground">
          We couldn't load your applications right now. Please refresh and try again.
        </Panel>
      ) : grouped.length ? (
        grouped.map(([vacancyId, { label, apps: vacancyApps }]) => (
          <section key={vacancyId}>
            <p className="eyebrow">
              {label} — {vacancyApps.length} applicant{vacancyApps.length === 1 ? "" : "s"}
            </p>
            <div className="mt-3 space-y-3">
              {vacancyApps.map((a) => {
                const player = a.player;
                const shortlisted = a.stage === "shortlisted";
                const invite = primaryInviteFor(invites, a.id);
                const activeInvite = Boolean(
                  invite && isInviteActive(invite),
                );
                const ended = a.stage === "rejected" || a.stage === "withdrawn";
                const meta = [player.primaryPosition, player.levelName, player.location]
                  .filter(Boolean)
                  .join(" • ");
                return (
                  <Panel key={a.id} id={`application-${a.id}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <Avatar initials={player.initials} imageUrl={player.photoUrl} alt={`${player.name} profile photo`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold"><AccountName verified={player.isVerified} owner={player.isOwner}>{player.name}</AccountName></p>
                        <p className="text-xs text-muted-foreground">
                          {meta ? `${meta} • ` : ""}Interest sent {appliedAgo(a.createdAt)}
                        </p>
                      </div>
                      <ApplicationStageBadge
                        stage={a.stage}
                        label={a.stage === "interested" ? "New interest" : undefined}
                      />
                    </div>

                    {invite ? (
                      <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="eyebrow">Trial invitation</p>
                          <TrialStatusBadge invite={invite} />
                        </div>
                        <div className="mt-2">
                          <TrialWhenWhere invite={invite} compact />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Player response:{" "}
                          <span className="font-semibold text-foreground">
                            {invite.status === "accepted"
                              ? "Accepted"
                              : invite.status === "declined"
                                ? `Declined${invite.declineReason ? ` — "${invite.declineReason}"` : ""}`
                                : invite.status === "cancelled"
                                  ? "Cancelled by you"
                                  : "Not responded yet"}
                          </span>
                        </p>
                        {isInviteActive(invite) ? (
                          <Button
                            variant="quiet"
                            size="sm"
                            className="mt-1 -ml-2"
                            disabled={cancelInvite.isPending}
                            onClick={() =>
                              cancelInvite.mutate(invite.id, {
                                onSuccess: () => toast.success("Trial invitation cancelled"),
                                onError: (e) =>
                                  toast.error("Couldn't cancel the invitation", {
                                    description: e instanceof Error ? e.message : undefined,
                                  }),
                              })
                            }
                          >
                            Cancel trial invitation
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button asChild variant="volt" size="sm">
                        <Link to="/club/players/$playerId" params={{ playerId: player.id }}>
                          View profile
                        </Link>
                      </Button>
                      <Button
                        variant={shortlisted ? "voltOutline" : "subtle"}
                        size="sm"
                        disabled={setStage.isPending}
                        onClick={() => move(a, "shortlisted", `${player.name} shortlisted`)}
                      >
                        <Star className={cn("size-4", shortlisted && "fill-current")} />
                        {shortlisted ? "Shortlisted" : "Shortlist"}
                      </Button>
                      <Button
                        variant={activeInvite ? "voltOutline" : "subtle"}
                        size="sm"
                        disabled={activeInvite || ended}
                        onClick={() => setInviteFor(a)}
                      >
                        <Ticket className="size-4" />
                        {activeInvite ? "Trial invite sent" : "Invite to trial"}
                      </Button>
                      <div className="ml-auto flex flex-wrap gap-1.5">
                        {clubStageOptions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={setStage.isPending}
                            onClick={() =>
                              s === "trial" && a.stage !== "trial"
                                ? setInviteFor(a)
                                : move(a, s, `${player.name} → ${applicationStageLabels[s]}`)
                            }
                            className={cn(
                              "cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:cursor-wait",
                              a.stage === s
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {applicationStageLabels[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <EmptyState
          title="No applications here"
          body={
            stageFilter
              ? "No applications at this stage yet. Try clearing the status filter."
              : "When a player registers interest in one of your vacancies, they'll appear here."
          }
        />
      )}

      <TrialInviteDialog
        open={inviteFor !== null}
        onOpenChange={(open) => {
          if (!open) setInviteFor(null);
        }}
        applicationId={inviteFor?.id ?? null}
        playerName={inviteFor?.player.name ?? "player"}
        vacancyLabel={inviteFor?.positionLabel ?? inviteFor?.vacancyTitle}
      />
    </div>
  );
}
