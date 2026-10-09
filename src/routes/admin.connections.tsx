/**
 * Admin > Successful Connections: read-only list of signed outcomes (full admin only, server-authorised).
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminEmpty, AdminShell, adminBeforeLoad, adminField, adminHead, formatDate } from "@/lib/admin-ui";
import {
  listAdminSuccessfulConnections,
  type AdminConnectionParty,
} from "@/lib/admin-connections.functions";
import { vacancyTitleFor } from "@/lib/club-vacancies";

export const Route = createFileRoute("/admin/connections")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Successful Connections"),
  component: AdminConnectionsPage,
});

function Party({ party }: { party: AdminConnectionParty }) {
  const tags = [
    party.hidden ? "hidden" : null,
    party.banned ? "banned" : null,
    party.switchedTo ? `now a ${party.switchedTo}` : null,
  ].filter(Boolean);
  if (party.deleted || !party.id) return <span className="text-muted-foreground">{party.name}</span>;
  return (
    <Link to="/admin/users/$profileId" params={{ profileId: party.id }} className="hover:underline">
      {party.name}
      {tags.length ? <span className="ml-1 text-xs font-normal text-muted-foreground">({tags.join(", ")})</span> : null}
    </Link>
  );
}

function AdminConnectionsPage() {
  const list = useServerFn(listAdminSuccessfulConnections);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin", "connections"],
    queryFn: () => list(),
  });
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [r.player.name, r.club.name, r.vacancy?.title ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <AdminShell
      title="Successful Connections"
      description="Players signed by clubs after a BallFindr trial. Recorded automatically when a club marks a player as Signed."
    >
      <input
        className={adminField}
        placeholder="Search player, club or vacancy"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <AdminEmpty>Loading connections…</AdminEmpty>
        ) : error ? (
          <AdminEmpty>Could not load connections.</AdminEmpty>
        ) : rows.length ? (
          rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  <Party party={r.player} /> <span className="text-muted-foreground">↔</span>{" "}
                  <Party party={r.club} />
                  {r.vacancy ? (
                    <>
                      {" "}
                      <span className="text-muted-foreground">↔</span>{" "}
                      {vacancyTitleFor(r.vacancy.positions) ?? r.vacancy.title ?? "Vacancy"}
                    </>
                  ) : null}
                </p>
                <span className="rounded-full border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--success)]">
                  Signed
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  r.playerPosition ? `Player position: ${r.playerPosition}` : null,
                  r.vacancy ? null : "Direct trial invite",
                  r.trialDate ? `Trial ${r.trialDate}` : null,
                  `Recorded ${formatDate(r.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>
          ))
        ) : (
          <AdminEmpty>{data.length ? "No connections match." : "No successful connections yet."}</AdminEmpty>
        )}
      </div>
    </AdminShell>
  );
}
