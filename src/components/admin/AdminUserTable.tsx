/**
 * Reusable searchable/filterable table of accounts used by Admin Users, Players and Clubs pages. Data comes from listAdminUsers (admin-data.functions).
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { AccountName } from "@/components/app/AccountName";
import type { AdminUserRow, AdminVerification } from "@/lib/admin-data.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resendAdminVerificationEmail } from "@/lib/admin-verification-email.functions";

/** BallFindr re-verification status (separate from Supabase Auth) + individual resend action (admins only). */
function EmailVerificationCell({ row }: { row: AdminUserRow }) {
  const resend = useServerFn(resendAdminVerificationEmail);
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () => resend({ data: { profileId: row.id } }),
    onSuccess: () => {
      toast.success("Verification email sent successfully.");
      qc.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send the verification email."),
  });
  if (row.emailReverification === null) return null;
  if (row.emailReverification === "reverified")
    return <span className="block text-xs text-primary">Email verification: ✅ Re-verified</span>;
  // Not re-verified: a Supabase confirmation email (confirmation_sent_at) or a BallFindr
  // resend counts as "Verification sent"; otherwise the user is genuinely not verified.
  const sent = row.emailReverification === "sent" || row.emailConfirmationSent === true;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <span className={sent ? "text-foreground" : "text-destructive"}>
        Email verification: {sent ? "📧 Verification sent" : "⚠️ Not verified"}
      </span>
      <button
        type="button"
        disabled={send.isPending}
        onClick={() => send.mutate()}
        className="font-semibold text-primary disabled:opacity-50"
      >
        {send.isPending ? "Sending…" : "Resend verification email"}
      </button>
    </span>
  );
}
import {
  AdminEmpty,
  matchesSectionFilter,
  SectionBadge,
  SectionFilter,
  TypeBadge,
  VerificationBadge,
  adminField,
  formatDate,
  type AdminSectionFilter,
} from "@/lib/admin-ui";

type Props = {
  rows: AdminUserRow[];
  /** Lock the table to one account type (Clubs / Players pages). */
  restrictTo?: "player" | "club";
  emptyMessage?: string;
};

export function AdminUserTable({ rows, restrictTo, emptyMessage }: Props) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "player" | "club">(restrictTo ?? "all");
  const [status, setStatus] = useState<"all" | AdminVerification>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [section, setSection] = useState<AdminSectionFilter>("all");
  const [emailStatus, setEmailStatus] = useState<"all" | "not_verified" | "sent" | "reverified">("all");
  const showEmailFilter = rows.some((r) => r.emailReverification !== null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = restrictTo ? rows.filter((r) => r.accountType === restrictTo) : rows;
    const result = base.filter((row) => {
      if (!restrictTo && type !== "all" && row.accountType !== type) return false;
      if (status !== "all" && row.verification !== status) return false;
      if (!matchesSectionFilter(row.section, section)) return false;
      if (emailStatus !== "all" && row.emailReverification !== emailStatus) return false;
      if (!term) return true;
      return (
        row.displayName.toLowerCase().includes(term) ||
        (row.email ?? "").toLowerCase().includes(term) ||
        (row.location ?? "").toLowerCase().includes(term) ||
        (row.detail ?? "").toLowerCase().includes(term)
      );
    });
    return result.sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "oldest" ? diff : -diff;
    });
  }, [rows, restrictTo, search, type, status, sort, section, emailStatus]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className={adminField}
          placeholder="Search name, email or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {restrictTo ? null : (
          <select className={adminField} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">All account types</option>
            <option value="player">Players</option>
            <option value="club">Clubs</option>
          </select>
        )}
        <select
          className={adminField}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">Any verification status</option>
          <option value="verified">Verified</option>
          <option value="pending">Awaiting review</option>
          <option value="unverified">Not verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <SectionFilter value={section} onChange={setSection} />
        {showEmailFilter ? (
          <select className={adminField} value={emailStatus} onChange={(e) => setEmailStatus(e.target.value as typeof emailStatus)}>
            <option value="all">Email: All</option>
            <option value="not_verified">Email: Not verified</option>
            <option value="sent">Email: Verification sent</option>
            <option value="reverified">Email: Re-verified</option>
          </select>
        ) : null}
        <select className={adminField} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {restrictTo ? rows.filter((r) => r.accountType === restrictTo).length : rows.length}
      </p>

      {filtered.length === 0 ? (
        <AdminEmpty>{emptyMessage ?? "No accounts match these filters."}</AdminEmpty>
      ) : (
        <div className="surface-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <AccountName verified={row.verification === "verified"} owner={row.isOwner} founder={row.isFounderClub}>{row.displayName}</AccountName>
                      {row.openReports > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <Flag className="size-3" />
                          {row.openReports}
                        </span>
                      ) : null}
                    </span>
                    {row.detail ? (
                      <span className="block text-xs text-muted-foreground">{row.detail}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={row.accountType} />
                  </td>
                  <td className="px-4 py-3">
                    <SectionBadge section={row.section} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.email ?? "—"}
                    <EmailVerificationCell row={row} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <VerificationBadge status={row.verification} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/users/$profileId"
                      params={{ profileId: row.id }}
                      className="text-sm font-semibold text-primary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
