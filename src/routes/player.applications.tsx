/**
 * Player > Applications: clubs/vacancies the player has applied to, with withdraw/reapply.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationStageBadge, EmptyState, PageHeader, Panel, Pill } from "@/components/app/ui";
import { TrialStatusBadge, TrialWhenWhere } from "@/components/app/TrialInviteBits";
import {
  applicationProgressStages,
  applicationStageLabels,
  appliedAgo,
  canWithdrawApplication,
  useMyApplications,
  type ApplicationStage,
} from "@/lib/applications";
import {
  primaryInviteFor,
  sortTrialInvites,
  trialDisplayStatus,
  useMyTrialInvites,
  type TrialInvite,
} from "@/lib/trial-invites";
import { cn } from "@/lib/utils";
import { useHashHighlight } from "@/lib/use-hash-highlight";
import { WithdrawInterestButton } from "@/components/app/WithdrawInterestButton";
import { AccountName } from "@/components/app/AccountName";

const title = "My applications — BallFindr";
const description =
  "Track every club application you've made on BallFindr, from interest sent through to trial and signing.";

export const Route = createFileRoute("/player/applications")({
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
  component: ApplicationsPage,
});

function Progress({ stage, closed = false }: { stage: ApplicationStage; closed?: boolean }) {
  // legacy `contacted` rows are shown as shortlisted (stage retired in the UI)
  const idx = applicationProgressStages.indexOf(stage === "contacted" ? "shortlisted" : stage);
  const ended = stage === "rejected" || stage === "withdrawn";
  const stageIndex = ended ? -1 : idx;
  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5">
        {applicationProgressStages.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= stageIndex ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
        {applicationProgressStages.map((s, i) => (
          <span key={s} className={cn(i <= stageIndex && "text-primary")}>
            {applicationStageLabels[s]}
          </span>
        ))}
      </div>
      {ended ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {stage === "rejected"
            ? "The club decided not to progress this one."
            : "You withdrew this application."}
        </p>
      ) : closed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Opportunity closed — the club is no longer recruiting for this position, so this
          application has ended.
        </p>
      ) : null}
    </div>
  );
}

function TrialCallout({ invite }: { invite: TrialInvite }) {
  const status = trialDisplayStatus(invite);
  const heading =
    status === "accepted"
      ? "Trial accepted"
      : status === "declined"
        ? "Trial declined"
        : status === "completed"
          ? "Trial completed"
          : status === "cancelled"
            ? "Trial cancelled"
            : "You've been invited to trial";
  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="size-4 text-primary" /> {heading}
        </p>
        <TrialStatusBadge invite={invite} />
      </div>
      <div className="mt-3">
        <TrialWhenWhere invite={invite} compact />
      </div>
      <Button asChild variant={status === "awaiting" ? "volt" : "subtle"} size="sm" className="mt-3">
        <Link to="/player/trials/$inviteId" params={{ inviteId: invite.id }}>
          {status === "awaiting" ? "View trial details & respond" : "View trial details"}
        </Link>
      </Button>
    </div>
  );
}

function TrialInviteCard({ invite }: { invite: TrialInvite }) {
  const status = trialDisplayStatus(invite);
  return (
    <Panel className={cn(status === "awaiting" && "border-primary/40")}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Ticket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold"><AccountName verified={invite.clubVerified} owner={invite.clubOwner} founder={invite.clubFounder}>{invite.clubName}</AccountName></p>
          <p className="text-xs text-muted-foreground">{invite.vacancyTitle ?? "Trial"}</p>
        </div>
        <TrialStatusBadge invite={invite} />
      </div>
      <div className="mt-4">
        <TrialWhenWhere invite={invite} compact />
      </div>
      <div className="mt-4 flex gap-2">
        <Button asChild variant={status === "awaiting" ? "volt" : "subtle"} size="sm">
          <Link to="/player/trials/$inviteId" params={{ inviteId: invite.id }}>
            {status === "awaiting" ? "Respond" : "View details"}
          </Link>
        </Button>
        <Button asChild variant="quiet" size="sm">
          <Link
            to="/player/clubs/$clubId"
            params={{ clubId: invite.clubId }}
            search={{ vacancy: invite.vacancyId ?? undefined }}
          >
            View club
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

function ApplicationsPage() {
  const { data, isLoading, error } = useMyApplications();
  const { data: inviteData, isLoading: invitesLoading } = useMyTrialInvites();
  const apps = data ?? [];
  useHashHighlight("application-", apps.map((a) => a.id).join(","));
  const invites = sortTrialInvites(inviteData ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My applications"
        subtitle="Every club you've shown interest in, and where it's up to."
      />

      <div className="space-y-3">
        {isLoading ? (
          <Panel className="text-sm text-muted-foreground">Loading your applications…</Panel>
        ) : error ? (
          <Panel className="text-sm text-muted-foreground">
            We couldn't load your applications right now. Please refresh and try again.
          </Panel>
        ) : apps.length ? (
          apps.map((app) => {
            const changed = app.updatedAt !== app.createdAt;
            // The vacancy itself was closed — separate from "Not progressed"
            // (club decision) and "Withdrawn" (player decision).
            const opportunityClosed =
              app.vacancyStatus !== "active" &&
              app.stage !== "rejected" &&
              app.stage !== "withdrawn" &&
              app.stage !== "accepted";
            const invite = primaryInviteFor(invites, app.id);
            return (
              <Panel key={app.id} id={`application-${app.id}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-elevated font-display text-xs font-extrabold text-primary">
                    {app.clubShort}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold"><AccountName verified={app.clubVerified} owner={app.clubOwner} founder={app.clubFounder}>{app.clubName}</AccountName></p>
                    <p className="text-xs text-muted-foreground">
                      {[app.positionLabel ?? app.vacancyTitle, app.levelName]
                        .filter(Boolean)
                        .join(" • ")}
                      {app.positionLabel || app.levelName ? " • " : ""}
                      Interest sent {appliedAgo(app.createdAt)}
                      {changed ? ` • Updated ${appliedAgo(app.updatedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {opportunityClosed ? <Pill>Opportunity closed</Pill> : null}
                    <ApplicationStageBadge stage={app.stage} />
                  </div>
                </div>
                <Progress stage={app.stage} closed={opportunityClosed} />
                {invite ? <TrialCallout invite={invite} /> : null}
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="subtle" size="sm">
                    <Link
                      to="/player/clubs/$clubId"
                      params={{ clubId: app.clubId }}
                      search={{ vacancy: app.vacancyId }}
                    >
                      View club
                    </Link>
                  </Button>
                  {canWithdrawApplication(app.stage) ? (
                    <WithdrawInterestButton applicationId={app.id} />
                  ) : null}
                </div>
              </Panel>
            );
          })
        ) : (
          <EmptyState
            title="No applications yet"
            body="Browse clubs recruiting near you and register your interest to get started."
          />
        )}
      </div>

      <section>
        <div>
          <p className="eyebrow">Trial invitations</p>
          <h2 className="mt-1 font-display text-xl uppercase">Trials you've been invited to</h2>
        </div>
        <div className="mt-4 space-y-3">
          {invitesLoading ? (
            <Panel className="text-sm text-muted-foreground">Loading trial invitations…</Panel>
          ) : invites.length ? (
            invites.map((invite) => <TrialInviteCard key={invite.id} invite={invite} />)
          ) : (
            <EmptyState
              title="No trial invitations yet"
              body="When a club invites you to trial, the date, time and venue will appear here."
            />
          )}
        </div>
      </section>
    </div>
  );
}
