/**
 * Admin dashboard: overview tiles linking to admin sections (staff only).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOverview } from "@/lib/admin-data.functions";
import { AccountName } from "@/components/app/AccountName";
import {
  AdminCard,
  AdminEmpty,
  AdminShell,
  AdminStat,
  ReportBadge,
  SectionBadge,
  TypeBadge,
  VerificationBadge,
  adminBeforeLoad,
  adminHead,
  formatDate,
} from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Overview"),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <AdminShell title="Overview" description="Live BallFindr platform activity.">
      {isLoading ? (
        <AdminEmpty>Loading platform statistics…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load platform statistics.</AdminEmpty>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStat label="Total users" value={data.stats.totalUsers} />
            <AdminStat label="Clubs" value={data.stats.totalClubs} hint={`${data.stats.verifiedClubs} verified`} />
            <AdminStat
              label="Players"
              value={data.stats.totalPlayers}
              hint={`${data.stats.verifiedPlayers} verified`}
            />
            <AdminStat label="Founder Clubs" value={data.stats.founderClubs} />
            <AdminStat label="New users this week" value={data.stats.newUsersWeek} />
            <AdminStat label="New users this month" value={data.stats.newUsersMonth} />
            <AdminStat label="New clubs this week" value={data.stats.newClubsWeek} />
            <AdminStat label="New players this week" value={data.stats.newPlayersWeek} />
            <AdminStat label="Awaiting verification" value={data.stats.awaitingVerification} />
            <AdminStat label="Outstanding reports" value={data.stats.openReports} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">Men's Football</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AdminStat label="Men's players" value={data.stats.mensPlayers} />
                <AdminStat label="Men's clubs" value={data.stats.mensClubs} />
              </div>
            </AdminCard>
            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">Women's Football</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AdminStat label="Women's players" value={data.stats.womensPlayers} />
                <AdminStat label="Women's clubs" value={data.stats.womensClubs} />
              </div>
            </AdminCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">Recently registered</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.recentUsers.length === 0 ? (
                  <li className="text-muted-foreground">No accounts yet.</li>
                ) : (
                  data.recentUsers.map((user) => (
                    <li key={user.id} className="flex items-center justify-between gap-3">
                      <Link
                        to="/admin/users/$profileId"
                        params={{ profileId: user.id }}
                        className="truncate font-medium text-foreground hover:text-primary"
                      >
                        <AccountName verified={user.verification === "verified"} owner={user.isOwner} founder={user.isFounderClub}>{user.displayName}</AccountName>
                      </Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <TypeBadge type={user.accountType} />
                        <SectionBadge section={user.section} />
                        <span className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </AdminCard>

            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">Recent reports</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.recentReports.length === 0 ? (
                  <li className="text-muted-foreground">No reports submitted.</li>
                ) : (
                  data.recentReports.map((report) => (
                    <li key={report.id} className="flex items-center justify-between gap-3">
                      {report.reportedProfileId ? (
                        <Link
                          to="/admin/users/$profileId"
                          params={{ profileId: report.reportedProfileId }}
                          className="truncate font-medium text-foreground hover:text-primary"
                        >
                          {report.reportedName}
                          <span className="ml-2 text-xs text-muted-foreground">{report.reason}</span>
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-muted-foreground">
                          {report.reportedName}
                          <span className="ml-2 text-xs text-muted-foreground">{report.reason}</span>
                        </span>
                      )}
                      <ReportBadge status={report.status} />
                    </li>
                  ))
                )}
              </ul>
            </AdminCard>

            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">New clubs</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.recentClubs.length === 0 ? (
                  <li className="text-muted-foreground">No clubs yet.</li>
                ) : (
                  data.recentClubs.map((club) => (
                    <li key={club.id} className="flex items-center justify-between gap-3">
                      <Link
                        to="/admin/users/$profileId"
                        params={{ profileId: club.id }}
                        className="truncate font-medium text-foreground hover:text-primary"
                      >
                        <AccountName verified={club.verification === "verified"} owner={club.isOwner} founder={club.isFounderClub}>{club.displayName}</AccountName>
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatDate(club.createdAt)}</span>
                    </li>
                  ))
                )}
              </ul>
            </AdminCard>

            <AdminCard>
              <h2 className="font-display text-sm uppercase tracking-wide">New players</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.recentPlayers.length === 0 ? (
                  <li className="text-muted-foreground">No players yet.</li>
                ) : (
                  data.recentPlayers.map((player) => (
                    <li key={player.id} className="flex items-center justify-between gap-3">
                      <Link
                        to="/admin/users/$profileId"
                        params={{ profileId: player.id }}
                        className="truncate font-medium text-foreground hover:text-primary"
                      >
                        <AccountName verified={player.verification === "verified"} owner={player.isOwner} founder={player.isFounderClub}>{player.displayName}</AccountName>
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatDate(player.createdAt)}</span>
                    </li>
                  ))
                )}
              </ul>
            </AdminCard>

            <AdminCard className="lg:col-span-2">
              <h2 className="font-display text-sm uppercase tracking-wide">Recent verification activity</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.recentVerification.length === 0 ? (
                  <li className="text-muted-foreground">No verification decisions yet.</li>
                ) : (
                  data.recentVerification.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3">
                      <Link
                        to="/admin/users/$profileId"
                        params={{ profileId: entry.id }}
                        className="truncate font-medium text-foreground hover:text-primary"
                      >
                        {entry.displayName}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <VerificationBadge status={entry.verification} />
                        <span className="text-xs text-muted-foreground">{formatDate(entry.decidedAt)}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </AdminCard>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
