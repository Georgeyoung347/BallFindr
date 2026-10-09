/**
 * Admin > single user detail: profile, edit dialog, email, account type, section, moderation and delete account cards.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Pencil, ShieldAlert, ShieldCheck, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getAdminStatus } from "@/lib/admin.functions";
import { deleteAccountPermanently } from "@/lib/admin-delete.functions";
import {
  getAccountModeration,
  liftRestriction,
  restrictAccount,
} from "@/lib/admin-moderation.functions";
import {
  getAdminUser,
  setFounderClub,
  setVerification,
  updateReport,
  type AdminReportStatus,
  type AdminVerification,
} from "@/lib/admin-data.functions";
import {
  AdminCard,
  AdminEmpty,
  AdminShell,
  ReportBadge,
  SectionBadge,
  TypeBadge,
  VerificationBadge,
  staffBeforeLoad,
  useStaffRole,
  adminField,
  adminHead,
  formatDate,
  PublicProfileLink,
} from "@/lib/admin-ui";
import { cn } from "@/lib/utils";
import { OwnerMark } from "@/components/app/AccountName";
import { AdminProfileEditDialog } from "@/components/admin/AdminProfileEditDialog";
import { AdminSectionCard } from "@/components/admin/AdminSectionCard";
import { AdminWarningsVisibilityCard } from "@/components/admin/AdminWarningsVisibilityCard";
import { AdminAccountTypeCard } from "@/components/admin/AdminAccountTypeCard";

export const Route = createFileRoute("/admin/users/$profileId")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: staffBeforeLoad,
  head: () => adminHead("Account"),
  component: AdminUserDetailPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" ) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

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

/** Admin-only restriction controls. Every action is enforced and audited server-side. */
function RestrictionCard({ profileId, name, isAdminUser }: { profileId: string; name: string; isAdminUser: boolean }) {
  const queryClient = useQueryClient();
  const fetchModeration = useServerFn(getAccountModeration);
  const restrict = useServerFn(restrictAccount);
  const lift = useServerFn(liftRestriction);
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "moderation", profileId],
    queryFn: () => fetchModeration({ data: { profileId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const apply = useMutation({
    mutationFn: (input: { kind: "temporary" | "permanent" }) =>
      restrict({
        data: {
          profileId,
          kind: input.kind,
          ...(input.kind === "temporary" ? { expiresAt } : {}),
          ...(reason.trim() ? { reason } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Account restricted");
      setReason("");
      setExpiresAt("");
      void refresh();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not restrict this account"),
  });

  const remove = useMutation({
    mutationFn: () => lift({ data: { profileId, ...(reason.trim() ? { note: reason } : {}) } }),
    onSuccess: () => {
      toast.success("Restriction lifted");
      setReason("");
      void refresh();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not lift the restriction"),
  });

  const active = data?.active ?? null;
  const busy = apply.isPending || remove.isPending;

  return (
    <AdminCard>
      <h2 className="font-display text-sm uppercase tracking-wide">Account restriction</h2>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="size-3" />
                {active.kind === "permanent"
                  ? "Permanently restricted"
                  : `Temporarily restricted until ${dateTime(active.expiresAt)}`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="size-3" /> No restriction
              </span>
            )}
          </div>
          {active ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Applied {dateTime(active.createdAt)}
              {active.reason ? ` · ${active.reason}` : ""}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 2000))}
              placeholder="Internal note / reason (administrators only)"
              className="resize-none rounded-xl border-border bg-elevated/60"
            />
            {active && !isAdminUser && active.kind === "permanent" ? (
              <p className="text-xs text-muted-foreground">Only an administrator can lift a permanent ban.</p>
            ) : active ? (
              <Button size="sm" variant="volt" disabled={busy} onClick={() => remove.mutate()}>
                <ShieldCheck className="size-4" /> Unban / restore account
              </Button>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label
                    htmlFor="restrict-expiry"
                    className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Temporary ban expires
                  </label>
                  <input
                    id="restrict-expiry"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className={cn(adminField, "mt-1 w-auto")}
                  />
                </div>
                <Button
                  size="sm"
                  variant="voltOutline"
                  disabled={busy || !expiresAt}
                  onClick={() => apply.mutate({ kind: "temporary" })}
                >
                  Apply temporary ban
                </Button>
                {isAdminUser ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => apply.mutate({ kind: "permanent" })}
                >
                  <ShieldAlert className="size-4" /> Permanently ban {name}
                </Button>
                ) : null}
              </div>
            )}
          </div>

          {data?.actions.length ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Moderation history
              </p>
              <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                {data.actions.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="border-b border-border/50 pb-2 last:border-0">
                    <span className="font-semibold text-foreground">
                      {entry.action.replaceAll("_", " ")}
                    </span>{" "}
                    · {dateTime(entry.createdAt)}
                    {entry.previousStatus || entry.newStatus
                      ? ` · ${entry.previousStatus ?? "—"} → ${entry.newStatus ?? "—"}`
                      : ""}
                    {entry.note ? <span className="block">{entry.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </AdminCard>
  );
}

/**
 * Permanent deletion. The button is only a shortcut: the server function
 * re-checks the admin role and refuses self-deletion regardless of the UI.
 */
function DangerZoneCard({ profileId, name }: { profileId: string; name: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useServerFn(getAdminStatus);
  const remove = useServerFn(deleteAccountPermanently);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const { data: me } = useQuery({ queryKey: ["admin", "status"], queryFn: () => status() });
  const isSelf = me?.userId === profileId;

  const del = useMutation({
    mutationFn: () => remove({ data: { profileId, confirm: "DELETE" } }),
    onSuccess: (result) => {
      setOpen(false);
      setTyped("");
      toast.success(`${result.displayName} has been permanently deleted`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void navigate({ to: "/admin/users" });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete this account"),
  });

  return (
    <AdminCard className="border-destructive/40">
      <h2 className="font-display text-sm uppercase tracking-wide text-destructive">Danger zone</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Permanently deletes the sign-in, the profile and everything this account owns. Reports and
        the moderation audit trail are kept. This cannot be undone.
      </p>
      {isSelf ? (
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          You cannot delete the administrator account you are signed in as.
        </p>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          className="mt-3"
          disabled={del.isPending}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" /> Delete Account Permanently
        </Button>
      )}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {name}&apos;s sign-in, profile, messages, media and
              everything else the account owns. It cannot be undone. Reports and moderation history
              are kept for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="confirm-delete" className="text-sm font-semibold">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className={adminField}
            placeholder="DELETE"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={typed !== "DELETE" || del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? "Deleting…" : "Permanently Delete Account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminCard>
  );
}

function AdminUserDetailPage() {
  const { profileId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchUser = useServerFn(getAdminUser);
  const decide = useServerFn(setVerification);
  const founder = useServerFn(setFounderClub);
  const change = useServerFn(updateReport);
  const [editOpen, setEditOpen] = useState(false);
  // Controls only; every admin-only action is re-checked server-side and in the database.
  const isAdminUser = useStaffRole() === "admin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "user", profileId],
    queryFn: () => fetchUser({ data: { profileId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const verify = useMutation({
    mutationFn: (status: AdminVerification) => decide({ data: { profileId, status } }),
    onSuccess: () => {
      toast.success("Verification updated");
      void refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update verification"),
  });

  const founderMutation = useMutation({
    mutationFn: (isFounder: boolean) => founder({ data: { clubId: profileId, isFounder } }),
    onSuccess: () => {
      toast.success("Founder Club status updated");
      void refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update Founder Club status"),
  });

  const reportMutation = useMutation({
    mutationFn: (input: { reportId: string; status: AdminReportStatus }) => change({ data: input }),
    onSuccess: () => {
      toast.success("Report updated");
      void refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update the report"),
  });

  const club = (data?.club ?? null) as Record<string, any> | null;
  const player = (data?.player ?? null) as Record<string, any> | null;

  return (
    <AdminShell
      title={data?.displayName ?? "Account"}
      description="Account detail and administrator actions."
      actions={
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" /> All users
        </Link>
      }
    >
      {isLoading ? (
        <AdminEmpty>Loading account…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load this account.</AdminEmpty>
      ) : (
        <div className="space-y-4">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={data.accountType} />
              <SectionBadge section={data.section} />
              <VerificationBadge status={data.verification} />
              {data.isOwner ? <span className="inline-flex items-center gap-1 text-xs font-semibold"><OwnerMark className="size-4" /> Owner Status: On</span> : null}
              {data.accountType === "club" && club?.['is_founder_club'] ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Star className="size-3" /> Founder Club
                </span>
              ) : null}
            </div>

            {isAdminUser ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="volt" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit Profile
              </Button>
              {data.verification !== "verified" ? (
                <Button size="sm" variant="volt" disabled={verify.isPending} onClick={() => verify.mutate("verified")}>
                  Verify account
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="voltOutline"
                  disabled={verify.isPending}
                  onClick={() => verify.mutate("unverified")}
                >
                  Remove verification
                </Button>
              )}
              {data.verification !== "rejected" ? (
                <Button size="sm" variant="ghost" disabled={verify.isPending} onClick={() => verify.mutate("rejected")}>
                  Reject verification
                </Button>
              ) : null}
              {data.verification !== "pending" ? (
                <Button size="sm" variant="ghost" disabled={verify.isPending} onClick={() => verify.mutate("pending")}>
                  Mark awaiting review
                </Button>
              ) : null}
              {data.accountType === "club" ? (
                <Button
                  size="sm"
                  variant={club?.['is_founder_club'] ? "voltOutline" : "volt"}
                  disabled={founderMutation.isPending}
                  onClick={() => founderMutation.mutate(!club?.['is_founder_club'])}
                >
                  {club?.['is_founder_club'] ? "Remove Founder Club status" : "Grant Founder Club status"}
                </Button>
              ) : null}
            </div>
            ) : null}
          </AdminCard>

          {isAdminUser ? <AdminProfileEditDialog profileId={data.id} open={editOpen} onOpenChange={setEditOpen} /> : null}

          <RestrictionCard profileId={data.id} name={data.displayName} isAdminUser={isAdminUser} />

          {data.accountType ? (
            <>
            {isAdminUser ? <AdminAccountTypeCard profileId={data.id} accountType={data.accountType} /> : null}
            {isAdminUser ? <AdminSectionCard profileId={data.id} accountType={data.accountType} section={data.section} /> : null}
              <AdminWarningsVisibilityCard profileId={data.id} name={data.displayName} accountType={data.accountType} />
            </>
          ) : null}

          {isAdminUser ? <DangerZoneCard profileId={data.id} name={data.displayName} /> : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">Account</h2>
              <dl className="mt-2 text-sm">
                <Row label="Name" value={data.displayName} />
                <Row label="Email" value={data.email ?? "—"} />
                <Row label="Registered" value={formatDate(data.createdAt)} />
                <Row label="Last sign in" value={formatDate(data.lastSignInAt)} />
                <Row label="Verification decided" value={formatDate(data.verificationDecidedAt)} />
                <Row label="Verification notes" value={data.verificationNotes} />
                <Row label="Owner Status" value={data.isOwner ? "On" : "Off"} />
                {data.accountType === "club" && club?.['founder_granted_at'] ? (
                  <Row label="Founder since" value={formatDate(club['founder_granted_at'])} />
                ) : null}
              </dl>
            </AdminCard>

            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">
                {data.accountType === "club" ? "Club details" : "Player details"}
              </h2>
              <dl className="mt-2 text-sm">
                {data.accountType === "club" ? (
                  <>
                    <Row label="Club name" value={club?.['name']} />
                    <Row label="Location" value={club?.['location']} />
                    <Row label="League" value={club?.['league']} />
                    <Row label="Home ground" value={club?.['home_ground']} />
                    <Row label="Founded" value={club?.['founded']} />
                    <Row label="Recruitment" value={club?.['recruitment_status']} />
                    <Row label="Contact" value={club?.['contact_name']} />
                    <Row label="Contact role" value={club?.['contact_role']} />
                  </>
                ) : (
                  <>
                    <Row label="Location" value={player?.['location']} />
                    <Row label="Current club" value={player?.['current_club_name']} />
                    <Row label="Primary position" value={player?.['primary_position']} />
                    <Row
                      label="Other positions"
                      value={(player?.['secondary_positions'] ?? []).join(", ") || null}
                    />
                    <Row label="Availability" value={player?.['availability']} />
                    <Row label="Open to trials" value={player?.['open_to_trials'] ? "Yes" : "No"} />
                    <Row label="Max travel" value={player?.['max_travel_miles'] ? `${player['max_travel_miles']} miles` : null} />
                  </>
                )}
              </dl>
              <PublicProfileLink
                targetId={data.id}
                targetType={data.accountType === "club" ? "club" : "player"}
                className="mt-3 inline-block text-sm font-semibold text-primary"
              />
            </AdminCard>
          </div>

          <AdminCard>
            <h2 className="font-display text-sm uppercase tracking-wide">
              Reports about this account ({data.reports.length})
            </h2>
            {data.reports.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No reports.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {data.reports.map((report) => (
                  <li key={report.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{report.reason}</span>
                      <ReportBadge status={report.status} />
                    </div>
                    {report.details ? (
                      <p className="mt-1 text-muted-foreground">{report.details}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {formatDate(report.createdAt)}
                      {report.reporterName ? ` by ${report.reporterName}` : ""}
                    </p>
                    {report.status === "open" ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="volt"
                          disabled={reportMutation.isPending}
                          onClick={() => reportMutation.mutate({ reportId: report.id, status: "resolved" })}
                        >
                          Mark resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={reportMutation.isPending}
                          onClick={() => reportMutation.mutate({ reportId: report.id, status: "dismissed" })}
                        >
                          Dismiss
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}
