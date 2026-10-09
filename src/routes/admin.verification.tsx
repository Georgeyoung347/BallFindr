/**
 * Admin > Verification: mark players/clubs verified.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listAdminUsers,
  setVerification,
  type AdminUserRow,
  type AdminVerification,
} from "@/lib/admin-data.functions";
import {
  AdminEmpty,
  AdminShell,
  matchesSectionFilter,
  SectionBadge,
  SectionFilter,
  TypeBadge,
  VerificationBadge,
  adminBeforeLoad,
  adminHead,
  formatDate,
  type AdminSectionFilter,
} from "@/lib/admin-ui";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";

export const Route = createFileRoute("/admin/verification")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Verification"),
  component: AdminVerificationPage,
});

const tabs: { key: AdminVerification; label: string }[] = [
  { key: "pending", label: "Awaiting review" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "unverified", label: "Not verified" },
];

function AdminVerificationPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const decide = useServerFn(setVerification);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminVerification>("pending");
  const [section, setSection] = useState<AdminSectionFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const mutation = useMutation({
    mutationFn: (input: { profileId: string; status: AdminVerification }) => decide({ data: input }),
    onSuccess: () => {
      toast.success("Verification updated");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update verification"),
  });

  const rows = useMemo<AdminUserRow[]>(
    () =>
      (data ?? []).filter(
        (row) => row.verification === tab && matchesSectionFilter(row.section, section),
      ),
    [data, tab, section],
  );

  const counts = (status: AdminVerification) =>
    (data ?? []).filter((row) => row.verification === status).length;

  return (
    <AdminShell
      title="Verification"
      description="Review accounts and approve or reject verification. Admin only."
    >
      <div className="mb-4 max-w-xs">
        <SectionFilter value={section} onChange={setSection} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
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

      {isLoading ? (
        <AdminEmpty>Loading accounts…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load accounts.</AdminEmpty>
      ) : rows.length === 0 ? (
        <AdminEmpty>Nothing in this list.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
            >
              <div className="min-w-0">
                <Link
                  to="/admin/users/$profileId"
                  params={{ profileId: row.id }}
                  className="font-medium text-foreground hover:text-primary"
                >
                  <AccountName verified={row.verification === "verified"} owner={row.isOwner} founder={row.isFounderClub}>{row.displayName}</AccountName>
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.email ?? "No email"} · Registered {formatDate(row.createdAt)}
                  {row.location ? ` · ${row.location}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={row.accountType} />
                <SectionBadge section={row.section} />
                <VerificationBadge status={row.verification} />
                {row.verification !== "verified" ? (
                  <Button
                    size="sm"
                    variant="volt"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ profileId: row.id, status: "verified" })}
                  >
                    Verify
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="voltOutline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ profileId: row.id, status: "unverified" })}
                  >
                    Remove verification
                  </Button>
                )}
                {row.verification !== "rejected" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ profileId: row.id, status: "rejected" })}
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
