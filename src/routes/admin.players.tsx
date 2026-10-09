/**
 * Admin > Players: player accounts list (staff only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { listAdminUsers } from "@/lib/admin-data.functions";
import { AdminEmpty, AdminShell, staffBeforeLoad, adminHead } from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/players")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: staffBeforeLoad,
  head: () => adminHead("Players"),
  component: AdminPlayersPage,
});

function AdminPlayersPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  return (
    <AdminShell title="Players" description="Player accounts, verification and moderation.">
      {isLoading ? (
        <AdminEmpty>Loading players…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load players.</AdminEmpty>
      ) : (
        <AdminUserTable rows={data} restrictTo="player" emptyMessage="No players match these filters." />
      )}
    </AdminShell>
  );
}
