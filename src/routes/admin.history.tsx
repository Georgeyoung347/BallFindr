/**
 * Admin > Action History: read-only audit log of admin/moderator actions with links to targets.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  getActionHistoryFilters, listActionHistory, type HistoryRange, type HistoryRow,
} from "@/lib/admin-history.functions";
import { AdminEmpty, AdminShell, TypeBadge, staffBeforeLoad, adminField, adminHead, formatDate, PublicProfileLink } from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/history")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: staffBeforeLoad,
  head: () => adminHead("Action History"),
  component: ActionHistoryPage,
});

const ACTION_LABELS: Record<string, string> = {
  report_open: "Report reopened",
  report_resolved: "Report resolved",
  report_dismissed: "Report dismissed",
  restriction_temporary: "Temporary ban",
  restriction_permanent: "Permanent ban",
  restriction_lifted: "Ban lifted",
  account_deleted: "Account deleted",
  admin_granted: "Admin role granted",
  admin_removed: "Admin role removed",
  moderator_granted: "Moderator role granted",
  moderator_removed: "Moderator role removed",
  warning_issued: "Warning issued",
  profile_hidden: "Profile hidden",
  profile_unhidden: "Profile unhidden",
  section_changed: "Section changed",
  account_type_changed: "Account Type Changed",
  email_changed: "Login Email Changed",
  profile_edited: "Profile edited",
};

/** Unknown/future action types still display readably. */
export function actionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const s = action.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ActionHistoryPage() {
  const fetchHistory = useServerFn(listActionHistory);
  const fetchFilters = useServerFn(getActionHistoryFilters);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [adminId, setAdminId] = useState("");
  const [range, setRange] = useState<HistoryRange>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<HistoryRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useQuery({ queryKey: ["admin", "history-filters"], queryFn: () => fetchFilters() });
  const history = useQuery({
    queryKey: ["admin", "history", { page, search, action, adminId, range }],
    queryFn: () => fetchHistory({ data: { page, search, action, adminId, range } }),
    placeholderData: keepPreviousData,
  });

  const total = history.data?.total ?? 0;
  const pageSize = history.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell title="Action History" description="Read-only audit record of admin and moderation actions, newest first.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_200px_200px_160px]">
          <input className={adminField} type="search" placeholder="Search account, admin, action or note"
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <select className={adminField} value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} aria-label="Filter by action">
            <option value="">All actions</option>
            {(filters.data?.actionTypes ?? []).map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
          <select className={adminField} value={adminId} onChange={(e) => { setAdminId(e.target.value); setPage(0); }} aria-label="Filter by staff member">
            <option value="">All admins</option>
            {(filters.data?.admins ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className={adminField} value={range} onChange={(e) => { setRange(e.target.value as HistoryRange); setPage(0); }} aria-label="Filter by date">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        {history.isLoading ? (
          <AdminEmpty>Loading history…</AdminEmpty>
        ) : history.error ? (
          <AdminEmpty>Could not load the action history.</AdminEmpty>
        ) : !history.data?.items.length ? (
          <AdminEmpty>No actions match these filters.</AdminEmpty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-elevated/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Account</th><th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Admin</th><th className="px-3 py-2">Old → New</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer border-t border-border hover:bg-elevated/40">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2 font-medium">{actionLabel(r.action)}</td>
                    <td className="px-3 py-2">{subjectText(r)}</td>
                    <td className="px-3 py-2">{r.subjectType ? <TypeBadge type={r.subjectType} /> : "—"}</td>
                    <td className="px-3 py-2">{r.adminName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.previousStatus || r.newStatus ? `${r.previousStatus ?? "—"} → ${r.newStatus ?? "—"}` : "—"}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-muted-foreground">{r.note ?? r.report?.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} action{total === 1 ? "" : "s"} · page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{actionLabel(selected.action)}</DialogTitle>
                <DialogDescription>{formatDate(selected.createdAt)}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <Detail label="Admin" value={selected.adminName} />
                <Detail label="Account" value={subjectText(selected)} />
                <Detail label="Account type" value={selected.subjectType === "club" ? "Club" : selected.subjectType === "player" ? "Player" : null} />
                <Detail label="Previous value" value={selected.previousStatus} />
                <Detail label="New value" value={selected.newStatus} />
                <Detail label={selected.action === "warning_issued" ? "Warning message" : "Reason / note"} value={selected.note} />
                {selected.restriction ? (
                  <>
                    <Detail label="Ban type" value={selected.restriction.kind} />
                    <Detail label="Ban reason" value={selected.restriction.reason} />
                    <Detail label="Ban expires" value={selected.restriction.expiresAt ? formatDate(selected.restriction.expiresAt) : null} />
                  </>
                ) : null}
                {selected.report ? (
                  <>
                    <Detail label="Report type" value={selected.report.kind} />
                    <Detail label="Report reason" value={selected.report.reason} />
                    <Detail label="Report status" value={selected.report.status} />
                    <Detail label="Report details" value={selected.report.details} />
                    <Detail label="Reported message" value={selected.report.messageBody} />
                  </>
                ) : null}
              </dl>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                {selected.subjectExists && selected.subjectProfileId && selected.subjectType ? (
                  <PublicProfileLink targetId={selected.subjectProfileId} targetType={selected.subjectType} className="text-sm font-semibold text-primary" />
                ) : null}
                {selected.subjectExists && selected.subjectProfileId ? (
                  <Button asChild size="sm">
                    <Link to="/admin/users/$profileId" params={{ profileId: selected.subjectProfileId }}>Open Account</Link>
                  </Button>
                ) : selected.subjectName || selected.action === "account_deleted" ? (
                  <span className="text-xs text-muted-foreground">Deleted account</span>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function subjectText(r: HistoryRow) {
  if (r.subjectExists) return r.subjectName ?? "—";
  if (r.subjectName) return `${r.subjectName} (deleted account)`;
  return r.action === "account_deleted" ? "(deleted account)" : "—";
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{value}</dd>
    </>
  );
}
