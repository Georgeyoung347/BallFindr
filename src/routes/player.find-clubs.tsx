/**
 * Player > Find Clubs: browse clubs/vacancies in the player's section (lib/discover-clubs, ClubOpportunityCard).
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, FieldLabel, FilterChip, PageHeader, Panel } from "@/components/app/ui";
import { ClubOpportunityCard } from "@/components/app/ClubOpportunityCard";
import { useSavedClubIds, useToggleSavedClub } from "@/lib/saved";
import { useDiscoverResults } from "@/lib/discover-clubs";
import { usePlayerLevels, dbPositions, type DbPosition } from "@/lib/player-profile";
import { trainingDayOptions, type TrainingDay } from "@/data/app-config";

const title = "Find your next club — BallFindr";
const description =
  "Search non-league and grassroots clubs recruiting players near you by level, position and training days.";

export const Route = createFileRoute("/player/find-clubs")({
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
  component: FindClubs,
});

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function FindClubs() {
  const { data: savedClubIds = [] } = useSavedClubIds();
  const toggleSavedClub = useToggleSavedClub();
  const { data: results = [], isLoading, error } = useDiscoverResults();
  const { data: levels = [] } = usePlayerLevels();

  const [query, setQuery] = useState("");
  const [selectedLevels, setLevels] = useState<number[]>([]);
  const [selectedPositions, setPositions] = useState<DbPosition[]>([]);
  const [trialsOnly, setTrialsOnly] = useState(false);
  const [vacanciesOnly, setVacanciesOnly] = useState(false);
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = results.filter(({ club, vacancy }) => {
      if (
        q &&
        ![club.name, club.location, club.league, club.levelName, vacancy?.title, vacancy?.positionLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (selectedLevels.length) {
        const levelId = vacancy?.levelId ?? club.levelId;
        if (!levelId || !selectedLevels.includes(levelId)) return false;
      }
      if (selectedPositions.length) {
        if (!vacancy || !vacancy.positions.some((p) => selectedPositions.includes(p))) return false;
      }
      if (trialsOnly && !vacancy?.trialsAvailable) return false;
      if (vacanciesOnly && !vacancy) return false;
      if (days.length) {
        const clubDays = vacancy?.trainingDays.length ? vacancy.trainingDays : club.trainingDays;
        if (!days.some((d) => clubDays.includes(d))) return false;
      }
      return true;
    });
    // Saved clubs first; stable sort keeps the existing order otherwise.
    const savedSet = new Set(savedClubIds);
    return list
      .map((r, i) => ({ r, i }))
      .sort((a, b) => Number(savedSet.has(b.r.club.id)) - Number(savedSet.has(a.r.club.id)) || a.i - b.i)
      .map(({ r }) => r);
  }, [results, query, selectedLevels, selectedPositions, trialsOnly, vacanciesOnly, days, savedClubIds]);

  const activeFilters =
    selectedLevels.length +
    selectedPositions.length +
    (trialsOnly ? 1 : 0) +
    (vacanciesOnly ? 1 : 0) +
    days.length;

  const clearAll = () => {
    setLevels([]);
    setPositions([]);
    setTrialsOnly(false);
    setVacanciesOnly(false);
    setDays([]);
  };

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <FieldLabel>Level</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {levels.map((l) => (
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
        <FieldLabel>Position wanted</FieldLabel>
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
        <FieldLabel>Opportunity</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          <FilterChip active={vacanciesOnly} onClick={() => setVacanciesOnly((v) => !v)}>
            Open vacancies
          </FilterChip>
          <FilterChip active={trialsOnly} onClick={() => setTrialsOnly((v) => !v)}>
            Trials available
          </FilterChip>
        </div>
      </div>
      <div>
        <FieldLabel>Training days</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {trainingDayOptions.map((d) => (
            <FilterChip key={d} active={days.includes(d)} onClick={() => setDays((s) => toggle(s, d))}>
              {d.slice(0, 3)}
            </FilterChip>
          ))}
        </div>
      </div>
      {activeFilters ? (
        <Button variant="quiet" size="sm" onClick={clearAll}>
          Clear all filters
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find your next club"
        subtitle="Discover clubs looking for players like you."
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clubs, leagues or areas"
            className="h-11 rounded-xl border-border bg-elevated/60 pl-9"
            aria-label="Search clubs"
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
              ? "Loading clubs"
              : `${filtered.length} club${filtered.length === 1 ? "" : "s"} found`}
          </p>
          {error ? (
            <EmptyState
              title="Couldn't load clubs"
              body="Something went wrong loading clubs. Refresh the page and try again."
            />
          ) : isLoading ? (
            <Panel className="text-sm text-muted-foreground">Loading clubs…</Panel>
          ) : filtered.length ? (
            filtered.map(({ key, club, vacancy }) => (
              <ClubOpportunityCard
                key={key}
                club={club}
                vacancy={vacancy}
                saveClub
                saved={savedClubIds.includes(club.id)}
                onToggleSave={() =>
                  toggleSavedClub.mutate({
                    clubId: club.id,
                    saved: savedClubIds.includes(club.id),
                  })
                }
              />
            ))
          ) : (
            <EmptyState
              title="No clubs match"
              body="Try clearing a filter or changing your search to see more opportunities."
            />
          )}
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg uppercase">Filters</p>
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
            <Button variant="volt" className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} results
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
