/**
 * Player > Find Players: browse other players (PlayerDirectoryCard).
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, FieldLabel, FilterChip, PageHeader, Panel } from "@/components/app/ui";
import { PlayerDirectoryCard } from "@/components/app/PlayerDirectoryCard";
import { useDiscoverPlayers, useLevels } from "@/lib/discover-players";
import { dbPositions, type DbAvailability, type DbPosition } from "@/lib/player-profile";
import { positionLabels } from "@/lib/club-vacancies";

const title = "Find players — BallFindr";
const description =
  "Browse other registered grassroots and non-league players by position, level, area and availability.";

export const Route = createFileRoute("/player/find-players")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayerFindPlayers,
});

const availabilities: { value: DbAvailability; label: string }[] = [
  { value: "actively_looking", label: "Actively looking" },
  { value: "open_to_offers", label: "Open to offers" },
  { value: "not_looking", label: "Not looking" },
];

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function PlayerFindPlayers() {
  const { data: players, isLoading, error } = useDiscoverPlayers();
  const { data: levels } = useLevels();
  const [query, setQuery] = useState("");
  const [selectedPositions, setPositions] = useState<DbPosition[]>([]);
  const [selectedLevels, setLevels] = useState<number[]>([]);
  const [availability, setAvailability] = useState<DbAvailability | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(
    () =>
      (players ?? []).filter((p) => {
        if (query) {
          const haystack = [
            p.name,
            p.location ?? "",
            p.currentClubName ?? "",
            p.primaryPosition ? positionLabels[p.primaryPosition] : "",
            p.primaryPosition ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        if (selectedPositions.length) {
          const owned = [p.primaryPosition, ...p.secondaryPositions].filter(Boolean);
          if (!selectedPositions.some((pos) => owned.includes(pos))) return false;
        }
        if (selectedLevels.length && (p.levelId === null || !selectedLevels.includes(p.levelId)))
          return false;
        if (availability && p.availability !== availability) return false;
        return true;
      }),
    [players, query, selectedPositions, selectedLevels, availability],
  );

  const activeFilters = selectedPositions.length + selectedLevels.length + (availability ? 1 : 0);

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <FieldLabel>Position</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {dbPositions.map((p) => (
            <FilterChip
              key={p}
              active={selectedPositions.includes(p)}
              onClick={() => setPositions((s) => toggle(s, p))}
            >
              {p}
            </FilterChip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Level</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(levels ?? []).map((l) => (
            <FilterChip
              key={l.id}
              active={selectedLevels.includes(l.id)}
              onClick={() => setLevels((s) => toggle(s, l.id))}
            >
              {l.name}
            </FilterChip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Availability</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {availabilities.map((a) => (
            <FilterChip
              key={a.value}
              active={availability === a.value}
              onClick={() => setAvailability(availability === a.value ? null : a.value)}
            >
              {a.label}
            </FilterChip>
          ))}
        </div>
      </div>
      {activeFilters ? (
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            setPositions([]);
            setLevels([]);
            setAvailability(null);
          }}
        >
          Clear all filters
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find players"
        subtitle="Browse other registered players and see how they're presenting themselves to clubs."
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, positions or areas"
            aria-label="Search players"
            className="h-11 rounded-xl border-border bg-elevated/60 pl-9"
          />
        </div>
        <Button
          variant="subtle"
          className="h-11 rounded-xl lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
          Filters{activeFilters ? ` (${activeFilters})` : ""}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Panel className="hidden h-fit lg:block">{filterPanel}</Panel>
        <div className="min-w-0 space-y-3">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
            {isLoading
              ? "Loading players"
              : `${results.length} player${results.length === 1 ? "" : "s"} listed`}
          </p>
          {isLoading ? (
            <Panel>
              <p className="text-sm text-muted-foreground">Loading players…</p>
            </Panel>
          ) : error ? (
            <Panel>
              <p className="text-sm text-muted-foreground">
                We couldn't load the player directory just now. Please refresh and try again.
              </p>
            </Panel>
          ) : results.length ? (
            results.map((p) => <PlayerDirectoryCard key={p.id} player={p} />)
          ) : (
            <EmptyState
              title="No players match"
              body="Relax a filter or clear your search to see more players."
            />
          )}
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Filters</p>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
                className="grid size-9 place-items-center rounded-xl border border-border"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <div className="mt-5">{filterPanel}</div>
            <Button className="mt-6 w-full" variant="volt" onClick={() => setFiltersOpen(false)}>
              Show {results.length} player{results.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
