/**
 * Club > Invited to Trial: sent invitations, responses and outcomes.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, Panel } from "@/components/app/ui";
import { TrialStatusBadge } from "@/components/app/TrialInviteBits";
import { OutcomeBadge, TrialOutcomeControls } from "@/components/club/TrialOutcomeControls";
import { formatTrialDate, formatTrialTimeRange } from "@/lib/trial-invites";
import { matchesName, useClubTrialEntries, type OutcomeDisplay } from "@/lib/trial-outcomes";
import { cn } from "@/lib/utils";
import { useHashHighlight } from "@/lib/use-hash-highlight";

const title = "Invited to Trial — BallFindr";
const description = "Every player your club has invited to trial, with their trial status and outcome.";

export const Route = createFileRoute("/club/trials")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClubTrialsPage,
});

const filters: (OutcomeDisplay | "all")[] = ["all", "pending", "passed", "signed", "not_signed"];
const filterLabel = { all: "All", pending: "Pending", passed: "Passed", signed: "Signed", not_signed: "Not Signed" } as const;

function ClubTrialsPage() {
  const { data: entries = [], isLoading, error } = useClubTrialEntries();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const list = useMemo(
    () => entries.filter((e) => (filter === "all" || e.outcome === filter) && matchesName(e.playerName, q)),
    [entries, filter, q],
  );
  useHashHighlight("trial-", list.map((e) => e.id).join(","));

  return (
    <div className="space-y-6">
      <PageHeader title="Invited to Trial" subtitle="All players you've invited to trial and how each trial ended." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by player name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {filterLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Loading trials…" body="Fetching your trial invitations." />
      ) : error ? (
        <EmptyState title="Couldn't load trials" body="Please refresh and try again." />
      ) : list.length ? (
        <div className="space-y-3">
          {list.map((e) => (
            <Panel key={e.id} id={`trial-${e.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/club/players/$playerId"
                    params={{ playerId: e.playerId }}
                    className="font-display text-lg uppercase hover:text-primary"
                  >
                    {e.playerName}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[e.playerPosition, e.vacancyTitle ?? "Direct invite"].filter(Boolean).join(" • ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trial {formatTrialDate(e.trialDate, { short: true })} · {formatTrialTimeRange(e)} · {e.venueName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.outcome === "pending" || e.outcome === "passed" ? (
                    <TrialStatusBadge invite={e} />
                  ) : (
                    <OutcomeBadge outcome={e.outcome} />
                  )}
                </div>
              </div>
              {e.outcome === "pending" || e.outcome === "passed" ? (
                <div className="mt-3 border-t border-border/70 pt-3">
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Outcome</p>
                  <TrialOutcomeControls entry={e} />
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState
          title={entries.length ? "No matching players" : "No trial invitations yet"}
          body={entries.length ? "Try a different name or filter." : "Players you invite to trial will appear here."}
        />
      )}
    </div>
  );
}
