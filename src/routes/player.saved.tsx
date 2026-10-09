/**
 * Player > Saved clubs list (lib/saved).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader, Panel, Pill } from "@/components/app/ui";
import { postedAgo } from "@/lib/discover-clubs";
import { AccountName } from "@/components/app/AccountName";
import {
  useSavedClubs,
  useSavedVacancies,
  useToggleSavedClub,
  useToggleSavedVacancy,
} from "@/lib/saved";

const title = "Saved clubs & opportunities — BallFindr";
const description =
  "The clubs and vacancies you've saved on BallFindr, ready to revisit and apply.";

export const Route = createFileRoute("/player/saved")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { data: savedClubs = [], isLoading: clubsLoading } = useSavedClubs();
  const { data: savedVacancies = [], isLoading: vacanciesLoading } = useSavedVacancies();
  const toggleSavedClub = useToggleSavedClub();
  const toggleSavedVacancy = useToggleSavedVacancy();

  return (
    <div className="space-y-6">
      <PageHeader title="Saved" subtitle="Clubs and opportunities you're keeping an eye on." />

      <section>
        <p className="eyebrow">Saved clubs</p>
        <div className="mt-3 space-y-3">
          {clubsLoading ? (
            <Panel className="text-sm text-muted-foreground">Loading saved clubs…</Panel>
          ) : savedClubs.length ? (
            savedClubs.map((club) => (
              <Panel key={club.id} className="flex flex-wrap items-center gap-3">
                <Avatar initials={club.short} imageUrl={club.badgeUrl} alt={`${club.name} badge`} className="size-11 object-contain text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold"><AccountName verified={club.isVerified} owner={club.isOwner} founder={club.isFounderClub}>{club.name}</AccountName></p>
                  <p className="text-xs text-muted-foreground">
                    {[club.levelName, club.league, club.location].filter(Boolean).join(" • ") ||
                      "Club details coming soon"}
                  </p>
                </div>
                <Button asChild variant="subtle" size="sm">
                  <Link to="/player/clubs/$clubId" params={{ clubId: club.id }}>
                    View
                  </Link>
                </Button>
                <button
                  type="button"
                  aria-label={`Remove ${club.name}`}
                  onClick={() => toggleSavedClub.mutate({ clubId: club.id, saved: true })}
                  className="grid size-9 cursor-pointer place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </Panel>
            ))
          ) : (
            <EmptyState
              title="No saved clubs"
              body="Tap the bookmark on any club to keep it here for later."
            />
          )}
        </div>
      </section>

      <section>
        <p className="eyebrow">Saved opportunities</p>
        <div className="mt-3 space-y-3">
          {vacanciesLoading ? (
            <Panel className="text-sm text-muted-foreground">Loading saved opportunities…</Panel>
          ) : savedVacancies.length ? (
            savedVacancies.map((v) => {
              const closed = v.status !== "active";
              return (
                <Panel
                  key={v.id}
                  className={
                    closed
                      ? "flex flex-wrap items-center gap-3 opacity-70"
                      : "flex flex-wrap items-center gap-3"
                  }
                >
                  <Bookmark
                    className={closed ? "size-4 text-muted-foreground" : "size-4 text-primary"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {v.positionLabel ?? v.title ?? "Vacancy"} — <AccountName verified={v.clubVerified} owner={v.clubOwner} founder={v.clubFounder}>{v.clubName}</AccountName>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {closed
                        ? "Opportunity closed — this vacancy is no longer available."
                        : [v.levelName, v.location, `posted ${postedAgo(v.createdAt)}`]
                            .filter(Boolean)
                            .join(" • ")}
                    </p>
                  </div>
                  {closed ? (
                    <Pill>Opportunity closed</Pill>
                  ) : v.positions[0] ? (
                    <Pill tone="primary">{v.positions[0]}</Pill>
                  ) : null}
                  <Button asChild variant="subtle" size="sm">
                    <Link
                      to="/player/clubs/$clubId"
                      params={{ clubId: v.clubId }}
                      search={{ vacancy: v.id }}
                    >
                      View
                    </Link>
                  </Button>
                  <button
                    type="button"
                    aria-label={`Remove ${v.positionLabel ?? v.title ?? "vacancy"}`}
                    onClick={() => toggleSavedVacancy.mutate({ vacancyId: v.id, saved: true })}
                    className="grid size-9 cursor-pointer place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </Panel>
              );
            })
          ) : (
            <EmptyState
              title="No saved opportunities"
              body="Save vacancies while browsing to compare them side by side."
            />
          )}
        </div>
      </section>
    </div>
  );
}
