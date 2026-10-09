/**
 * Player > Trial Invites list.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/ui";
import { TrialStatusBadge, TrialWhenWhere } from "@/components/app/TrialInviteBits";
import { sortTrialInvites, trialDisplayStatus, useMyTrialInvites, type TrialInvite } from "@/lib/trial-invites";
import { AccountName } from "@/components/app/AccountName";
import { cn } from "@/lib/utils";

const title = "Trial invites — BallFindr";
const description = "Every trial invitation clubs have sent you on BallFindr, with its current status.";

export const Route = createFileRoute("/player/trials/")({
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
  component: TrialInvitesPage,
});

function InviteCard({ invite }: { invite: TrialInvite }) {
  const status = trialDisplayStatus(invite);
  const fromApplication = Boolean(invite.applicationId);
  return (
    <Panel className={cn(status === "awaiting" && "border-primary/40")}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Ticket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            <AccountName verified={invite.clubVerified} owner={invite.clubOwner} founder={invite.clubFounder}>
              {invite.clubName}
            </AccountName>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {fromApplication ? (
              <>
                {invite.vacancyTitle ? (
                  <span className="text-xs text-muted-foreground">{invite.vacancyTitle}</span>
                ) : null}
                <Pill>From your application</Pill>
              </>
            ) : (
              <Pill>Direct invite</Pill>
            )}
          </div>
        </div>
        <TrialStatusBadge invite={invite} />
      </div>
      <div className="mt-4">
        <TrialWhenWhere invite={invite} compact />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant={status === "awaiting" ? "volt" : "subtle"} size="sm">
          <Link to="/player/trials/$inviteId" params={{ inviteId: invite.id }}>
            {status === "awaiting" ? "View & respond" : "View details"}
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

function TrialInvitesPage() {
  const { data, isLoading, error } = useMyTrialInvites();
  const invites = sortTrialInvites(data ?? []);
  const pending = invites.filter((i) => trialDisplayStatus(i) === "awaiting").length;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Trial invites"
        subtitle={
          pending > 0
            ? `You have ${pending} invitation${pending === 1 ? "" : "s"} waiting for your reply.`
            : "Every trial invitation you've received, with its current status."
        }
      />
      <div className="space-y-3">
        {isLoading ? (
          <Panel className="text-sm text-muted-foreground">Loading trial invitations…</Panel>
        ) : error ? (
          <Panel className="text-sm text-destructive">Couldn't load your trial invitations. Please try again.</Panel>
        ) : invites.length ? (
          invites.map((invite) => <InviteCard key={invite.id} invite={invite} />)
        ) : (
          <EmptyState
            title="No trial invitations yet"
            body="When a club invites you to trial, the date, time and venue will appear here."
          />
        )}
      </div>
    </div>
  );
}
