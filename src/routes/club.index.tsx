/**
 * Club dashboard: profile completion, vacancies and recent activity overview.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Eye, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard, ApplicationStageBadge, Avatar } from "@/components/app/ui";
import { DiscoverPlayerCard } from "@/components/app/DiscoverPlayerCard";
import { useDiscoverPlayers } from "@/lib/discover-players";
import { useSavedPlayerIds, useToggleSavedPlayer } from "@/lib/saved-players";
import { useSignedInClubProfile } from "@/lib/club-profile";
import { isAllPositions, useClubVacancies } from "@/lib/club-vacancies";
import { appliedAgo, useClubApplications } from "@/lib/applications";
import { useMyProfileViewCount } from "@/lib/profile-views";
import { clubCoreInfoComplete, clubProfileStrength } from "@/lib/profile-completion";
import { ProfileStrength } from "@/components/profile/ProfileStrength";

/**
 * Re-orders the existing discovery results so players matching the club's open
 * vacancy positions come first. Positions with more open places rank higher; a
 * primary-position match beats a secondary one. "All Positions" vacancies give no
 * specific priority. Non-matching players keep their existing order afterwards.
 */
function rankForOpenRoles<P extends { primaryPosition: string | null; secondaryPositions: string[] }>(
  players: P[],
  openVacancies: { positions: string[]; expiresAt?: string | null }[],
): P[] {
  const now = Date.now();
  const demand = new Map<string, number>();
  for (const v of openVacancies) {
    if (v.expiresAt && new Date(v.expiresAt).getTime() < now) continue;
    if (!v.positions.length || isAllPositions(v.positions)) continue;
    for (const pos of new Set(v.positions)) demand.set(pos, (demand.get(pos) ?? 0) + 1);
  }
  if (!demand.size) return players;
  const score = (p: P) => {
    const primary = p.primaryPosition ? demand.get(p.primaryPosition) ?? 0 : 0;
    const secondary = Math.max(0, ...p.secondaryPositions.map((s) => demand.get(s) ?? 0));
    // Places for the matched position dominate; primary match breaks ties.
    return Math.max(primary, secondary) * 2 + (primary > 0 && primary >= secondary ? 1 : 0);
  };
  return players
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p);
}

const title = "Club dashboard — BallFindr";
const description =
  "Your club recruitment dashboard: active vacancies, new applicants, recommended players and profile views.";

export const Route = createFileRoute("/club/")({
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
  component: ClubDashboard,
});

function ClubDashboard() {
  const { data: club } = useSignedInClubProfile();
  const { data: vacancies = [] } = useClubVacancies();
  const { data: applications = [] } = useClubApplications();
  const { data: profileViews = 0 } = useMyProfileViewCount();
  const active = vacancies.filter((v) => v.status === "active");
  const newInterest = applications.filter((a) => a.stage === "interested").length;
  const shortlisted = applications.filter((a) => a.stage === "shortlisted").length;
  const { data: discoveredPlayers, isLoading: playersLoading } = useDiscoverPlayers();
  const { data: savedIds } = useSavedPlayerIds();
  const toggleSaved = useToggleSavedPlayer();
  const recommended = rankForOpenRoles(discoveredPlayers ?? [], active).slice(0, 3);
  const clubName = club?.name ?? "";
  const strength = club ? clubProfileStrength(club) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={clubName ? `Good evening, ${clubName} 👋` : "Good evening 👋"}
        subtitle="Here's what's happening with your recruitment."
        action={
          <Button asChild variant="volt" size="sm">
            <Link to="/club/vacancies/new">+ Post a vacancy</Link>
          </Button>
        }
      />

      {club && !clubCoreInfoComplete(club) ? (
        <Panel className="border-primary/40 bg-primary/5">
          <p className="eyebrow">Core Information required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your club isn't discoverable by players yet. Complete your Core Information so players
            can find your club.
          </p>
          <Button asChild variant="volt" size="sm" className="mt-4">
            <Link to="/welcome">Complete Core Information</Link>
          </Button>
        </Panel>
      ) : null}

      {strength !== null && strength < 100 ? (
        <ProfileStrength
          strength={strength}
          hint="Complete your club details, history and achievements to reach 100%."
          action={
            <Button asChild variant="volt" size="sm">
              <Link to="/club/profile">Complete profile</Link>
            </Button>
          }
        />
      ) : null}


      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active vacancies" value={active.length} icon={Megaphone} />
        <StatCard
          label="Applications"
          value={applications.length}
          hint={
            applications.length === 0
              ? "No applications yet"
              : `${newInterest} new • ${shortlisted} shortlisted`
          }
          icon={ClipboardList}
        />
        
        <StatCard
          label="Profile views"
          value={profileViews}
          hint={profileViews === 0 ? "No views yet" : "Players who viewed your club"}
          icon={Eye}
        />
      </div>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Recommended players</p>
            <h2 className="mt-1 font-display text-xl uppercase">Fits for your open roles</h2>
          </div>
          <Button asChild variant="quiet" size="sm">
            <Link to="/club/find-players">See all</Link>
          </Button>
        </div>
        {playersLoading ? (
          <Panel className="mt-4">
            <p className="text-sm text-muted-foreground">Loading players…</p>
          </Panel>
        ) : recommended.length === 0 ? (
          <Panel className="mt-4">
            <p className="text-sm text-muted-foreground">
              No players to show yet. As more players join BallFindr, they'll appear here.
            </p>
          </Panel>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recommended.map((p) => (
              <DiscoverPlayerCard
                key={p.id}
                player={p}
                saved={(savedIds ?? []).includes(p.id)}
                onToggleSaved={() =>
                  toggleSaved.mutate({
                    playerId: p.id,
                    saved: (savedIds ?? []).includes(p.id),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <p className="eyebrow">Recent applications</p>
          <Button asChild variant="quiet" size="sm">
            <Link to="/club/applications">View all</Link>
          </Button>
        </div>
        <Panel className="mt-3">
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No applications yet. Players who register interest in your vacancies will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {applications.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-elevated/50 p-3"
                >
                  <Avatar initials={a.player.initials} imageUrl={a.player.photoUrl} alt={`${a.player.name} profile photo`} className="size-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.player.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.positionLabel ?? a.vacancyTitle, `Applied ${appliedAgo(a.createdAt)}`]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <ApplicationStageBadge stage={a.stage} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
