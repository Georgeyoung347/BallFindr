/**
 * Admin > Trial Invites: read-only list of all trial invitations (full admin only).
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminEmpty, AdminShell, adminBeforeLoad, adminField, adminHead, formatDate } from "@/lib/admin-ui";
import { listAdminTrialInvites, type AdminTrialInvite, type AdminTrialParty } from "@/lib/admin-trials.functions";
import { isInvitePassed } from "@/lib/trial-invites";
import { applicationStageLabels, type ApplicationStage } from "@/lib/applications";
import { vacancyTitleFor } from "@/lib/club-vacancies";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/trials")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Trial Invites"),
  component: AdminTrialsPage,
});

type AdminTrialStatus = "pending" | "accepted" | "declined" | "cancelled" | "passed" | "signed" | "not_signed";

const statusLabels: Record<AdminTrialStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  passed: "Passed",
  signed: "Signed",
  not_signed: "Not Signed",
};

const statusTone: Record<AdminTrialStatus, string> = {
  pending: "border-primary/40 bg-primary/15 text-primary",
  accepted: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  signed: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
  not_signed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-elevated text-muted-foreground",
  passed: "border-border bg-elevated text-muted-foreground",
};

/** Recorded outcome wins; otherwise the stored status, with Passed derived exactly as elsewhere. */
function adminStatus(i: AdminTrialInvite): AdminTrialStatus {
  if (i.outcome) return i.outcome.outcome;
  if (i.status === "cancelled" || i.status === "declined" || i.status === "accepted") return i.status;
  return isInvitePassed(i) ? "passed" : "pending";
}

function vacancyName(i: AdminTrialInvite) {
  if (!i.vacancy) return null;
  return vacancyTitleFor(i.vacancy.positions) ?? i.vacancy.title ?? "Vacancy";
}

function PartyName({ party }: { party: AdminTrialParty }) {
  if (party.state === "deleted" || !party.id) return <span className="text-muted-foreground">{party.name}</span>;
  return (
    <Link to="/admin/users/$profileId" params={{ profileId: party.id }} className="hover:underline">
      {party.name}
      {party.state === "hidden" ? <span className="ml-1 text-xs text-muted-foreground">(hidden)</span> : null}
    </Link>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

function AdminTrialsPage() {
  const list = useServerFn(listAdminTrialInvites);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "trial-invites"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminTrialStatus | "">("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .map((i) => ({ i, s: adminStatus(i) }))
      .filter(({ i, s }) => (!status || s === status) && (!q || `${i.player.name} ${i.club.name}`.toLowerCase().includes(q)));
  }, [data, search, status]);

  return (
    <AdminShell title="Trial Invites" description="Read-only view of every trial invite across BallFindr.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={adminField} placeholder="Search player or club" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={cn(adminField, "sm:max-w-48")} value={status} onChange={(e) => setStatus(e.target.value as AdminTrialStatus | "")}>
          <option value="">All statuses</option>
          {(Object.keys(statusLabels) as AdminTrialStatus[]).map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <AdminEmpty>Loading trial invites…</AdminEmpty>
        ) : error ? (
          <AdminEmpty>Could not load trial invites.</AdminEmpty>
        ) : rows.length ? (
          rows.map(({ i, s }) => {
            const expanded = open === i.id;
            const vac = vacancyName(i);
            return (
              <div key={i.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <PartyName party={i.player} /> <span className="text-muted-foreground">↔</span> <PartyName party={i.club} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[vac ?? "Direct trial invite", `${i.trialDate} ${i.startTime}–${i.endTime}`, i.venueName, `Sent ${formatDate(i.createdAt)}`].join(" • ")}
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone[s])}>{statusLabels[s]}</span>
                </div>
                <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => setOpen(expanded ? null : i.id)}>
                  {expanded ? "Hide details" : "View details"}
                </button>
                {expanded ? (
                  <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
                    <Row label="Player" value={<PartyName party={i.player} />} />
                    <Row label="Club" value={<PartyName party={i.club} />} />
                    <Row label="Vacancy" value={vac ? `${vac}${i.vacancy ? ` (${i.vacancy.status})` : ""}` : "Direct trial invite"} />
                    <Row label="Status" value={statusLabels[s]} />
                    <Row label="Trial date" value={i.trialDate} />
                    <Row label="Time" value={`${i.startTime}–${i.endTime}`} />
                    <Row label="Arrival" value={i.arrivalTime} />
                    <Row label="Venue" value={i.venueName} />
                    <Row label="Address" value={`${i.streetAddress}, ${i.postcode}`} />
                    <Row label="Surface" value={i.surface === "other" ? i.surfaceOther || "Other" : i.surface.toUpperCase()} />
                    <Row label="What to bring" value={i.whatToBring} />
                    <Row label="Kit" value={i.kitInstructions} />
                    <Row label="Changing" value={i.changingInfo} />
                    <Row label="Instructions" value={i.additionalInstructions} />
                    <Row label="Contact" value={[i.contactName, i.contactPhone].filter(Boolean).join(" • ")} />
                    <Row label="Notes" value={i.notes} />
                    <Row label="Decline reason" value={i.declineReason} />
                    <Row label="Responded" value={i.respondedAt ? formatDate(i.respondedAt) : null} />
                    <Row label="Sent" value={formatDate(i.createdAt)} />
                    <Row
                      label="Application"
                      value={i.application ? `${applicationStageLabels[i.application.stage as ApplicationStage] ?? i.application.stage} • applied ${formatDate(i.application.createdAt)}` : "None (direct invite)"}
                    />
                    <Row
                      label="Outcome"
                      value={i.outcome ? `${statusLabels[i.outcome.outcome]} • recorded ${formatDate(i.outcome.createdAt)}` : "Not recorded"}
                    />
                  </dl>
                ) : null}
              </div>
            );
          })
        ) : (
          <AdminEmpty>{data.length ? "No trial invites match." : "No trial invites yet."}</AdminEmpty>
        )}
      </div>
    </AdminShell>
  );
}
