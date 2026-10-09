/**
 * Admin > Founder Clubs: grant/remove Founder Club status.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AccountName, FounderClubMark } from "@/components/app/AccountName";
import { listAdminUsers, setFounderClub } from "@/lib/admin-data.functions";
import {
  AdminEmpty,
  AdminShell,
  matchesSectionFilter,
  SectionBadge,
  SectionFilter,
  type AdminSectionFilter,
  VerificationBadge,
  adminBeforeLoad,
  adminField,
  adminHead,
  formatDate,
} from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/founder-clubs")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Founder Clubs"),
  component: AdminFounderClubsPage,
});

function AdminFounderClubsPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const grant = useServerFn(setFounderClub);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<AdminSectionFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const mutation = useMutation({
    mutationFn: (input: { clubId: string; isFounder: boolean }) => grant({ data: input }),
    onSuccess: (_result, input) => {
      toast.success(input.isFounder ? "Founder Club status granted" : "Founder Club status removed");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update Founder Club status"),
  });

  const clubs = useMemo(
    () =>
      (data ?? []).filter(
        (row) => row.accountType === "club" && matchesSectionFilter(row.section, section),
      ),
    [data, section],
  );
  const founders = clubs.filter((club) => club.isFounderClub);
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clubs;
    return clubs.filter(
      (club) =>
        club.displayName.toLowerCase().includes(term) ||
        (club.location ?? "").toLowerCase().includes(term) ||
        (club.detail ?? "").toLowerCase().includes(term),
    );
  }, [clubs, search]);

  return (
    <AdminShell
      title="Founder Clubs"
      description="Grant or remove Founder Club status. Only administrators can change this."
    >
      {isLoading ? (
        <AdminEmpty>Loading clubs…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load clubs.</AdminEmpty>
      ) : (
        <div className="space-y-6">
          <div className="surface-card rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide">
              <FounderClubMark className="size-4" /> Current Founder Clubs ({founders.length})
            </h2>
            {founders.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No Founder Clubs yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {founders.map((club) => (
                  <li key={club.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to="/admin/users/$profileId"
                      params={{ profileId: club.id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      <AccountName verified={club.verification === "verified"} owner={club.isOwner} founder>{club.displayName}</AccountName>
                    </Link>
                    <SectionBadge section={club.section} />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ clubId: club.id, isFounder: false })}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                className={adminField}
                placeholder="Search clubs by name, league or location"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <SectionFilter value={section} onChange={setSection} />
            </div>
            {matches.length === 0 ? (
              <AdminEmpty>No clubs match that search.</AdminEmpty>
            ) : (
              matches.map((club) => (
                <div
                  key={club.id}
                  className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div className="min-w-0">
                    <Link
                      to="/admin/users/$profileId"
                      params={{ profileId: club.id }}
                      className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
                    >
                      <AccountName verified={club.verification === "verified"} owner={club.isOwner} founder={club.isFounderClub}>{club.displayName}</AccountName>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[club.detail, club.location].filter(Boolean).join(" · ") || "No club details yet"} ·
                      Registered {formatDate(club.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SectionBadge section={club.section} />
                    <VerificationBadge status={club.verification} />
                    <Button
                      size="sm"
                      variant={club.isFounderClub ? "voltOutline" : "volt"}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ clubId: club.id, isFounder: !club.isFounderClub })}
                    >
                      {club.isFounderClub ? "Remove Founder status" : "Grant Founder status"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
