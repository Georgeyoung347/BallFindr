/**
 * Admin > Clubs: club accounts list (staff only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { listAdminUsers } from "@/lib/admin-data.functions";
import { AdminEmpty, AdminShell, staffBeforeLoad, adminHead } from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/clubs")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: staffBeforeLoad,
  head: () => adminHead("Clubs"),
  component: AdminClubsPage,
});

function AdminClubsPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  return (
    <AdminShell title="Clubs" description="Club accounts, verification and Founder Club status.">
      {isLoading ? (
        <AdminEmpty>Loading clubs…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load clubs.</AdminEmpty>
      ) : (
        <AdminUserTable rows={data} restrictTo="club" emptyMessage="No clubs match these filters." />
      )}
    </AdminShell>
  );
}
