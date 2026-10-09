/**
 * Admin > Owner Status: protected toggle for the BallFindr owner mark (full admin only).
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountName, OwnerMark } from "@/components/app/AccountName";
import { listAdminUsers, setOwnerStatus, type AdminUserRow } from "@/lib/admin-data.functions";
import {
  AdminEmpty, AdminShell, SectionBadge, TypeBadge, adminBeforeLoad,
  adminField, adminHead,
} from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/owner-status")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Owner Status"),
  component: OwnerStatusPage,
});

function OwnerStatusPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const setStatus = useServerFn(setOwnerStatus);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });
  const mutation = useMutation({
    mutationFn: (input: { profileId: string; isOwner: boolean }) => setStatus({ data: input }),
    onSuccess: (_result, input) => {
      toast.success(input.isOwner ? "Owner Status enabled" : "Owner Status disabled");
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change Owner Status"),
  });
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((row) =>
      !term || row.displayName.toLowerCase().includes(term) ||
      (row.email ?? "").toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <AdminShell title="Owner Status" description="Manage the BallFindr Owner badge for player and club accounts.">
      <div className="space-y-4">
        <label className="block max-w-md text-sm font-medium">
          Search players and clubs
          <input
            className={`${adminField} mt-2`}
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {isLoading ? <AdminEmpty>Loading accounts…</AdminEmpty> : error || !data ? (
          <AdminEmpty>Could not load accounts.</AdminEmpty>
        ) : matches.length === 0 ? <AdminEmpty>No accounts match that search.</AdminEmpty> : (
          <div className="space-y-2">
            {matches.map((row) => (
              <div key={row.id} className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-4">
                <div className="min-w-0">
                  <Link to="/admin/users/$profileId" params={{ profileId: row.id }} className="font-semibold text-foreground hover:text-primary">
                    <AccountName verified={row.verification === "verified"} founder={row.isFounderClub} owner={row.isOwner}>{row.displayName}</AccountName>
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <TypeBadge type={row.accountType} />
                    <SectionBadge section={row.section} />
                    <span>Owner Status: {row.isOwner ? "On" : "Off"}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={row.isOwner ? "voltOutline" : "volt"}
                  disabled={mutation.isPending}
                  onClick={() => setSelected(row)}
                >
                  {row.isOwner ? "Disable" : "Enable"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <AlertDialog open={selected !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) setSelected(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected?.isOwner ? "Disable" : "Enable"} Owner Status?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected?.isOwner ? "Remove" : "Show"} the BallFindr Owner logo beside {selected?.displayName}'s name? Verification Status will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 text-sm"><OwnerMark className="size-5" /> {selected?.displayName}</div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.isPending} onClick={(event) => {
              event.preventDefault();
              if (selected) mutation.mutate({ profileId: selected.id, isOwner: !selected.isOwner });
            }}>
              {mutation.isPending ? "Saving…" : `Confirm ${selected?.isOwner ? "disable" : "enable"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
