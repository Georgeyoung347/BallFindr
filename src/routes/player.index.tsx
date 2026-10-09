/**
 * Player dashboard (Home): profile completion, invites and recommended clubs.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, MapPin, Ticket, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Pill, StatCard } from "@/components/app/ui";
import { ClubOpportunityCard } from "@/components/app/ClubOpportunityCard";
import { TrialStatusBadge, TrialWhenWhere } from "@/components/app/TrialInviteBits";
import { useSavedClubIds, useSavedVacancyIds, useToggleSavedClub, useToggleSavedVacancy } from "@/lib/saved";
import { useSignedInPlayerProfile } from "@/lib/player-profile";
import { postedAgo, useDiscoverResults } from "@/lib/discover-clubs";
import { useMyApplications } from "@/lib/applications";
import { sortTrialInvites, trialDisplayStatus, useMyTrialInvites } from "@/lib/trial-invites";
import { useMyProfileViewCount } from "@/lib/profile-views";
import { usePlayerProfileExtras } from "@/lib/player-profile";
import { playerCoreInfoComplete, playerProfileStrength } from "@/lib/profile-completion";
import { ProfileStrength } from "@/components/profile/ProfileStrength";
import { availabilityLabels } from "@/data/app-config";
import { AccountName } from "@/components/app/AccountName";

const title = "Player home — BallFindr";
const description =
  "Your BallFindr player dashboard: clubs recruiting near you, profile activity and recommended opportunities.";

export const Route = createFileRoute("/player/")({
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
  component: PlayerHome,
});

function PlayerHome() {
  const { data: savedClubIds = [] } = useSavedClubIds();
  const { data: savedVacancyIds = [] } = useSavedVacancyIds();
  const toggleSavedVacancy = useToggleSavedVacancy();
  const toggleSavedClub = useToggleSavedClub();
  const { data: profile } = useSignedInPlayerProfile();
  const { data: discovered = [] } = useDiscoverResults();
  const { data: applications = [] } = useMyApplications();
  const { data: invites = [] } = useMyTrialInvites();
  const { data: profileViews = 0 } = useMyProfileViewCount();
  const { data: extras } = usePlayerProfileExtras();
  const pendingInvites = invites.filter((i) => trialDisplayStatus(i) === "awaiting").length;
  const strength = profile ? playerProfileStrength(profile, extras) : null;
  const recommended = discovered.slice(0, 3);
  const firstName = (profile?.fullName ?? "").split(" ")[0];

  // Real counts from the signed-in player's own applications (RLS scoped).
  const shortlisted = applications.filter((a) => a.stage === "shortlisted").length;
  const trials = applications.filter((a) => a.stage === "trial").length;
  const applicationsHint =
    applications.length === 0
      ? "No applications yet"
      : [
          trials > 0 ? `${trials} trial invite${trials === 1 ? "" : "s"}` : null,
          shortlisted > 0 ? `${shortlisted} shortlisted` : null,
        ]
          .filter(Boolean)
          .join(" • ") || "In progress";

  // Clubs with at least one open vacancy, from real data.
  const recruitingClubs = new Set(discovered.filter((d) => d.vacancy).map((d) => d.club.id)).size;
  const openVacancies = discovered
    .filter((d) => d.vacancy)
    .slice(0, 4)
    .map((d) => ({ club: d.club, vacancy: d.vacancy! }));

  // Pending / upcoming trial invitations — only shown when there is one.
  const upcomingTrials = sortTrialInvites(invites).filter((i) => {
    const s = trialDisplayStatus(i);
    return s === "awaiting" || s === "accepted";
  });
  const nextTrial = upcomingTrials[0];

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={firstName ? `Good evening, ${firstName} 👋` : "Good evening 👋"}
        subtitle="Here's what's happening around you."
      />

      {profile && !playerCoreInfoComplete(profile) ? (
        <Panel className="border-primary/40 bg-primary/5">
          <p className="eyebrow">Core Information required</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your profile isn't visible to clubs yet. Complete your Core Information so clubs can
            discover you.
          </p>
          <Button asChild variant="volt" size="sm" className="mt-4">
            <Link to="/welcome">Complete Core Information</Link>
          </Button>
        </Panel>
      ) : null}

      {strength !== null && strength < 100 ? (
        <ProfileStrength
          strength={strength}
          action={
            <Button asChild variant="volt" size="sm">
              <Link to="/player/profile">Complete profile</Link>
            </Button>
          }
        />
      ) : null}


      <Panel className={pendingInvites > 0 ? "border-primary/40 bg-primary/5" : ""}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Ticket className="size-5" />
            {pendingInvites > 0 ? (
              <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {pendingInvites}
              </span>
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Trial invites</p>
            <p className="mt-1 font-display text-lg uppercase">
              {pendingInvites > 0
                ? `${pendingInvites} invite${pendingInvites === 1 ? "" : "s"} waiting for you`
                : invites.length > 0
                  ? "No invites waiting"
                  : "No trial invites yet"}
            </p>
          </div>
          <Button asChild variant={pendingInvites > 0 ? "volt" : "subtle"} size="sm" className="shrink-0">
            <Link to="/player/trials">View trial invites</Link>
          </Button>
        </div>
      </Panel>

      {nextTrial ? (
        <Panel className="border-primary/40 bg-primary/5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Ticket className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">
                  {nextTrial.status === "pending" ? "Trial invitation" : "Upcoming trial"}
                </p>
                <TrialStatusBadge invite={nextTrial} />
              </div>
              <p className="mt-1 font-display text-lg uppercase">
                <AccountName verified={nextTrial.clubVerified} owner={nextTrial.clubOwner} founder={nextTrial.clubFounder}>{nextTrial.clubName}</AccountName>
                {nextTrial.vacancyTitle ? ` · ${nextTrial.vacancyTitle}` : ""}
              </p>
              <div className="mt-3">
                <TrialWhenWhere invite={nextTrial} compact />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="volt" size="sm">
                  <Link to="/player/trials/$inviteId" params={{ inviteId: nextTrial.id }}>
                    {nextTrial.status === "pending" ? "View & respond" : "View trial details"}
                  </Link>
                </Button>
                {upcomingTrials.length > 1 ? (
                  <Button asChild variant="quiet" size="sm">
                    <Link to="/player/applications">
                      +{upcomingTrials.length - 1} more trial{upcomingTrials.length - 1 === 1 ? "" : "s"}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}



      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Panel className="flex items-center justify-between gap-4">
          <div>
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-4.5" />
            </span>
            <p className="mt-3 font-display text-lg uppercase">
              {recruitingClubs} club{recruitingClubs === 1 ? " is" : "s are"} looking
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clubs currently recruiting players like you.
            </p>
            <Button asChild variant="volt" size="sm" className="mt-4">
              <Link to="/player/find-clubs">View clubs</Link>
            </Button>
          </div>
        </Panel>

        <Panel>
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Eye className="size-4.5" />
          </span>
          <p className="mt-3 font-display text-lg uppercase">
            {profileViews} profile view{profileViews === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {profileViews === 0
              ? "No clubs have viewed your profile yet."
              : "Clubs that viewed your profile."}
          </p>
          <Button asChild variant="subtle" size="sm" className="mt-4">
            <Link to="/player/applications">View activity</Link>
          </Button>
        </Panel>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <StatCard
          label="Applications"
          value={applications.length}
          hint={applicationsHint}
          icon={TrendingUp}
        />
        <StatCard label="Saved clubs" value={savedClubIds.length} hint="Shortlist your favourites" />
        <StatCard
          label="Availability"
          value={
            profile?.availability ? availabilityLabels[profile.availability] : "Not specified"
          }
        />
      </div>

      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Recommended for you</p>
            <h2 className="mt-1 font-display text-xl uppercase">Clubs that need your position</h2>
          </div>
          <Button asChild variant="quiet" size="sm" className="shrink-0">
            <Link to="/player/find-clubs">See all</Link>
          </Button>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
          {recommended.map(({ key, club, vacancy }) => (
            <ClubOpportunityCard
              key={key}
              club={club}
              vacancy={vacancy}
              saved={
                vacancy
                  ? savedVacancyIds.includes(vacancy.id)
                  : savedClubIds.includes(club.id)
              }
              onToggleSave={
                vacancy
                  ? () =>
                      toggleSavedVacancy.mutate({
                        vacancyId: vacancy.id,
                        saved: savedVacancyIds.includes(vacancy.id),
                      })
                  : () =>
                      toggleSavedClub.mutate({
                        clubId: club.id,
                        saved: savedClubIds.includes(club.id),
                      })
              }
            />
          ))}
        </div>
      </div>

      <Panel>
        <p className="eyebrow">Nearby activity</p>
        {openVacancies.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No clubs have posted an open vacancy yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {openVacancies.map(({ club, vacancy }) => (
              <li key={vacancy.id} className="flex flex-wrap items-center gap-2 text-sm">
                {vacancy.positionLabel ? <Pill tone="primary">{vacancy.positionLabel}</Pill> : null}
                <span className="font-semibold"><AccountName verified={club.isVerified} owner={club.isOwner} founder={club.isFounderClub}>{club.name}</AccountName></span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {[vacancy.location ?? club.location, `posted ${postedAgo(vacancy.createdAt)}`]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
