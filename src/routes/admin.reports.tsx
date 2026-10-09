/**
 * Admin > Reports: review reports and apply moderation (warn, hide, restrict, restore).
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flag, MessageSquare, ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listAdminReports,
  updateReport,
  type AdminReportKind,
  type AdminReportRow,
  type AdminReportStatus,
} from "@/lib/admin-data.functions";
import {
  AdminEmpty,
  AdminShell,
  ReportBadge,
  matchesSectionFilter,
  SectionBadge,
  SectionFilter,
  TypeBadge,
  staffBeforeLoad,
  adminHead,
  formatDate,
  type AdminSectionFilter,
} from "@/lib/admin-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reports")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: staffBeforeLoad,
  head: () => adminHead("Reports"),
  component: AdminReportsPage,
});

const statusTabs: { key: AdminReportStatus; label: string }[] = [
  { key: "open", label: "Outstanding" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

const kindTabs: { key: AdminReportKind | "all"; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "profile", label: "Profiles" },
  { key: "message", label: "Messages" },
];

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportCard({
  report,
  busy,
  onAct,
}: {
  report: AdminReportRow;
  busy: boolean;
  onAct: (status: AdminReportStatus, notes: string) => void;
}) {
  const [notes, setNotes] = useState(report.resolutionNotes ?? "");

  return (
    <div className="surface-card space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {report.kind === "message" ? (
                <MessageSquare className="size-3" />
              ) : (
                <UserRound className="size-3" />
              )}
              {report.kind === "message" ? "Message report" : "Profile report"}
            </span>
            {report.restriction ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="size-3" />
                {report.restriction.kind === "permanent"
                  ? "Permanently restricted"
                  : `Restricted until ${dateTime(report.restriction.expiresAt)}`}
              </span>
            ) : null}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            {report.reportedProfileId ? (
              <Link
                to="/admin/users/$profileId"
                params={{ profileId: report.reportedProfileId }}
                className="font-medium break-words text-foreground hover:text-primary"
              >
                {report.reportedName}
              </Link>
            ) : (
              <span className="font-medium break-words text-muted-foreground">
                {report.reportedName}
              </span>
            )}
            <TypeBadge type={report.reportedType} />
            <SectionBadge section={report.reportedSection} />
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{report.reason}</p>
          {report.details ? (
            <p className="mt-1 text-sm break-words text-muted-foreground">{report.details}</p>
          ) : null}
        </div>
        <ReportBadge status={report.status} />
      </div>

      {report.kind === "message" ? (
        <div className="rounded-xl border border-border bg-elevated/50 p-3">
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Reported message
          </p>
          <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-foreground">
            {report.messageBody ?? "This message is no longer available."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sent {dateTime(report.messageSentAt)}
            {report.conversationId ? ` · Conversation ${report.conversationId.slice(0, 8)}` : ""}
          </p>
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold">Reported by: </dt>
          <dd className="inline">
            {report.reporterProfileId ? (
              <Link
                to="/admin/users/$profileId"
                params={{ profileId: report.reporterProfileId }}
                className="text-primary"
              >
                {report.reporterName ?? "Unknown"}
              </Link>
            ) : (
              (report.reporterName ?? "Unknown")
            )}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Report submitted: </dt>
          <dd className="inline">{dateTime(report.createdAt)}</dd>
        </div>
        {report.resolvedAt ? (
          <div>
            <dt className="inline font-semibold">Closed: </dt>
            <dd className="inline">{formatDate(report.resolvedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-2">
        <label
          htmlFor={`notes-${report.id}`}
          className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
        >
          Internal moderation note (administrators only)
        </label>
        <Textarea
          id={`notes-${report.id}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
          placeholder="What did you find, and what did you do?"
          className="resize-none rounded-xl border-border bg-elevated/60"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {report.status !== "resolved" ? (
          <Button size="sm" variant="volt" disabled={busy} onClick={() => onAct("resolved", notes)}>
            Mark resolved
          </Button>
        ) : null}
        {report.status !== "dismissed" ? (
          <Button
            size="sm"
            variant="voltOutline"
            disabled={busy}
            onClick={() => onAct("dismissed", notes)}
          >
            Dismiss
          </Button>
        ) : null}
        {report.status !== "open" ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAct("open", notes)}>
            Reopen
          </Button>
        ) : null}
        {report.reportedProfileId ? (
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/users/$profileId" params={{ profileId: report.reportedProfileId }}>
              Open profile &amp; restrict
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AdminReportsPage() {
  const fetchReports = useServerFn(listAdminReports);
  const change = useServerFn(updateReport);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminReportStatus>("open");
  const [kind, setKind] = useState<AdminReportKind | "all">("all");
  const [section, setSection] = useState<AdminSectionFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => fetchReports(),
  });

  const mutation = useMutation({
    mutationFn: (input: { reportId: string; status: AdminReportStatus; notes?: string }) =>
      change({ data: input }),
    onSuccess: () => {
      toast.success("Report updated");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update the report"),
  });

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((row) => row.status === tab)
        .filter((row) => kind === "all" || row.kind === kind)
        .filter((row) => matchesSectionFilter(row.reportedSection, section)),
    [data, tab, kind, section],
  );
  const counts = (status: AdminReportStatus) =>
    (data ?? []).filter((r) => r.status === status).length;

  return (
    <AdminShell
      title="Reports"
      description="Moderation queue. Reports are submitted by members and only administrators can see or resolve them."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {statusTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
              tab === item.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label} ({counts(item.key)})
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {kindTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setKind(item.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              kind === item.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
            )}
          >
            <Flag className="size-3" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-5 max-w-xs">
        <SectionFilter value={section} onChange={setSection} />
      </div>

      {isLoading ? (
        <AdminEmpty>Loading reports…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load reports.</AdminEmpty>
      ) : rows.length === 0 ? (
        <AdminEmpty>Nothing in this list.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {rows.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={mutation.isPending}
              onAct={(status, notes) =>
                mutation.mutate({ reportId: report.id, status, ...(notes.trim() ? { notes } : {}) })
              }
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
