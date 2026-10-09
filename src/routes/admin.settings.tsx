/**
 * Admin > Settings: admin's own account settings.
 */
import { deactivateCurrentDevice } from "@/lib/push-devices";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { getAdminOverview } from "@/lib/admin-data.functions";
import { AdminCard, AdminShell, adminBeforeLoad, adminHead, formatDate } from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/settings")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Settings"),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { adminUser } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getAdminOverview);
  const { data } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchOverview() });

  async function signOut() {
    await deactivateCurrentDevice();
    await supabase.auth.signOut();
    queryClient.clear(); // never show this account's cached data to the next one
    void navigate({ to: "/admin/login", replace: true });
  }

  return (
    <AdminShell title="Settings" description="Administrator account and platform information.">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard>
          <h2 className="font-display text-sm uppercase tracking-wide">Administrator account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right font-medium">{adminUser.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Account created</dt>
              <dd className="text-right">{formatDate(adminUser.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Permission</dt>
              <dd className="text-right font-medium text-primary">Administrator</dd>
            </div>
          </dl>
          <Button variant="voltOutline" size="sm" className="mt-4" onClick={signOut}>
            Sign out
          </Button>
        </AdminCard>

        <AdminCard>
          <h2 className="font-display text-sm uppercase tracking-wide">Platform</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Registered accounts</dt>
              <dd>{data?.stats.totalUsers ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Clubs / players</dt>
              <dd>
                {data ? `${data.stats.totalClubs} / ${data.stats.totalPlayers}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Founder Clubs</dt>
              <dd>{data?.stats.founderClubs ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Outstanding reports</dt>
              <dd>{data?.stats.openReports ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Administrator access is granted only in the database (user_roles) and is separate from the
            player/club account type. It cannot be granted from this website.
          </p>
        </AdminCard>
      </div>
    </AdminShell>
  );
}
