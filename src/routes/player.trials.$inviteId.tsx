/**
 * Player > one trial invite: details and accept/decline.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApplicationStageBadge, Panel } from "@/components/app/ui";
import { TrialDetailsList, TrialStatusBadge, TrialWhenWhere } from "@/components/app/TrialInviteBits";
import { AccountName } from "@/components/app/AccountName";
import { useMyApplications } from "@/lib/applications";
import {
  isTrialPast,
  trialDisplayStatus,
  useRespondToTrialInvite,
  useTrialInvite,
} from "@/lib/trial-invites";

const title = "Trial invitation — BallFindr";
const description = "View a club's trial invitation, including date, time, venue and what to bring.";

export const Route = createFileRoute("/player/trials/$inviteId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrialInvitePage,
});

function BackLink() {
  return (
    <Button asChild variant="quiet" size="sm" className="-ml-2">
      <Link to="/player/applications">
        <ArrowLeft className="size-4" /> Back to applications
      </Link>
    </Button>
  );
}

function TrialInvitePage() {
  const { inviteId } = Route.useParams();
  const { data: invite, isLoading, error } = useTrialInvite(inviteId);
  const { data: apps } = useMyApplications();
  const respond = useRespondToTrialInvite();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Panel className="text-sm text-muted-foreground">Loading trial invitation…</Panel>
      </div>
    );
  }
  if (error || !invite) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Panel className="text-sm text-muted-foreground">
          {error
            ? "We couldn't load this trial invitation right now. Please refresh and try again."
            : "Trial invitation not found — it may have been removed, or the link is invalid."}
        </Panel>
      </div>
    );
  }

  const application = apps?.find((a) => a.id === invite.applicationId);
  const status = trialDisplayStatus(invite);
  const past = isTrialPast(invite);
  const canRespond = invite.status === "pending" && status !== "passed";
  const canDeclineAfterAccept = invite.status === "accepted" && !past;

  const send = (response: "accepted" | "declined") =>
    respond.mutate(
      { id: invite.id, response, ...(response === "declined" ? { declineReason: reason } : {}) },
      {
        onSuccess: () => {
          setDeclining(false);
          toast.success(response === "accepted" ? "Trial accepted" : "Invitation declined");
        },
        onError: (e) =>
          toast.error("Couldn't save your response", {
            description: e instanceof Error ? e.message : undefined,
          }),
      },
    );

  return (
    <div className="space-y-6">
      <BackLink />

      <Panel className="border-primary/30 bg-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Trial invitation</p>
            <h1 className="mt-1 font-display text-2xl uppercase sm:text-3xl"><AccountName verified={invite.clubVerified} owner={invite.clubOwner} founder={invite.clubFounder}>{invite.clubName}</AccountName></h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invite.vacancyTitle ?? "Trial"} · You've been invited to trial.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {application ? <ApplicationStageBadge stage={application.stage} /> : null}
            <TrialStatusBadge invite={invite} />
          </div>
        </div>

        <div className="mt-5">
          <TrialWhenWhere invite={invite} />
        </div>

        {status === "awaiting" ? (
          <div className="mt-5 rounded-xl border border-primary/30 bg-background/60 p-4">
            <p className="text-sm font-semibold">Please let {invite.clubName} know if you can attend.</p>
            {declining ? (
              <div className="mt-3 space-y-3">
                <Textarea
                  rows={3}
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional — let the club know why (e.g. unavailable that day)"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" disabled={respond.isPending} onClick={() => send("declined")}>
                    <X className="size-4" /> {respond.isPending ? "Saving…" : "Confirm decline"}
                  </Button>
                  <Button variant="subtle" disabled={respond.isPending} onClick={() => setDeclining(false)}>
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="volt" disabled={respond.isPending} onClick={() => send("accepted")}>
                  <Check className="size-4" /> {respond.isPending ? "Saving…" : "Accept trial"}
                </Button>
                <Button variant="subtle" disabled={respond.isPending} onClick={() => setDeclining(true)}>
                  <X className="size-4" /> Decline trial
                </Button>
              </div>
            )}
          </div>
        ) : status === "accepted" ? (
          <div className="mt-5 rounded-xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 p-4 text-sm">
            <p className="font-semibold text-[color:var(--success)]">Trial accepted</p>
            <p className="mt-1 text-muted-foreground">
              You've told {invite.clubName} you'll be there. The club will update your application
              separately after the trial.
            </p>
            {canDeclineAfterAccept ? (
              declining ? (
                <div className="mt-3 space-y-3">
                  <Textarea
                    rows={3}
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional — let the club know why you can no longer attend"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="destructive" size="sm" disabled={respond.isPending} onClick={() => send("declined")}>
                      {respond.isPending ? "Saving…" : "Confirm I can't attend"}
                    </Button>
                    <Button variant="subtle" size="sm" disabled={respond.isPending} onClick={() => setDeclining(false)}>
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="quiet" size="sm" className="mt-2 -ml-2" onClick={() => setDeclining(true)}>
                  Can no longer attend?
                </Button>
              )
            ) : null}
          </div>
        ) : status === "declined" ? (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold text-destructive">Trial declined</p>
            <p className="mt-1 text-muted-foreground">
              You declined this invitation
              {invite.declineReason ? ` — "${invite.declineReason}"` : "."}
            </p>
          </div>
        ) : status === "passed" ? (
          <p className="mt-5 text-sm text-muted-foreground">
            This invitation has passed. The trial date and time have gone by, so it can no longer be accepted or declined.
          </p>
        ) : status === "cancelled" ? (
          <p className="mt-5 text-sm text-muted-foreground">{invite.clubName} has cancelled this trial.</p>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            This trial has taken place.{" "}
            {invite.status === "pending" ? "You didn't respond to the invitation." : "Good luck with the outcome."}
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <p className="eyebrow">Trial details</p>
          <div className="mt-2">
            <TrialDetailsList invite={invite} />
          </div>
        </Panel>

        <Panel className="h-fit">
          <p className="eyebrow">Your application</p>
          <p className="mt-3 text-sm">
            {application
              ? `Your application to ${invite.clubName} is currently at "${application.stage === "trial" ? "Trial invited" : application.stage}". Accepting this trial doesn't change that — the club will update it after the trial.`
              : "This trial is linked to one of your applications."}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild variant="subtle" size="sm">
              <Link to="/player/applications">View my applications</Link>
            </Button>
            <Button asChild variant="quiet" size="sm">
              <Link to="/player/clubs/$clubId" params={{ clubId: invite.clubId }} search={{ vacancy: invite.vacancyId ?? undefined }}>
                View club
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
