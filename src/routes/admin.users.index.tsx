/**
 * Admin > Users: every registered account (staff only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { listAdminUsers } from "@/lib/admin-data.functions";
import { AdminEmpty, AdminShell, staffBeforeLoad, adminHead } from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/users/")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: staffBeforeLoad,
  head: () => adminHead("Users"),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  return (
    <AdminShell title="Users" description="Every registered BallFindr account.">
      {isLoading ? (
        <AdminEmpty>Loading accounts…</AdminEmpty>
      ) : error || !data ? (
        <AdminEmpty>Could not load accounts.</AdminEmpty>
      ) : (
        <AdminUserTable rows={data} />
      )}
    </AdminShell>
  );
}
