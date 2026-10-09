/**
 * Admin > Roles: grant/revoke admin and moderator roles with safeguards (full admin only).
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountName } from "@/components/app/AccountName";
import {
  listAdminUsers, listStaffRoles, setStaffRole, type AdminUserRow,
} from "@/lib/admin-data.functions";
import {
  AdminEmpty, AdminShell, TypeBadge, adminBeforeLoad, adminField, adminHead,
} from "@/lib/admin-ui";

export const Route = createFileRoute("/admin/roles")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Admin Roles"),
  component: AdminRolesPage,
});

type Role = "admin" | "moderator" | "none";
const roleLabel: Record<Role, string> = { admin: "Admin", moderator: "Moderator", none: "No Role" };
const roleTone: Record<Role, string> = {
  admin: "rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-semibold text-primary",
  moderator: "rounded-full border border-foreground/30 bg-elevated px-2.5 py-0.5 font-semibold text-foreground",
  none: "rounded-full border border-border px-2.5 py-0.5 font-semibold",
};

function AdminRolesPage() {
  const { adminUser } = Route.useRouteContext();
  const fetchUsers = useServerFn(listAdminUsers);
  const fetchRoles = useServerFn(listStaffRoles);
  const changeRole = useServerFn(setStaffRole);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [selected, setSelected] = useState<{ row: AdminUserRow; from: Role; to: Role } | null>(null);

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => fetchUsers() });
  const roles = useQuery({ queryKey: ["admin", "staff-roles"], queryFn: () => fetchRoles() });
  const roleById = useMemo(() => {
    const map = new Map<string, Role>();
    for (const r of roles.data ?? []) {
      if (r.role === "admin" || !map.has(r.userId)) map.set(r.userId, r.role);
    }
    return map;
  }, [roles.data]);
  const roleOf = (id: string): Role => roleById.get(id) ?? "none";

  const mutation = useMutation({
    mutationFn: (input: { profileId: string; role: Role }) => changeRole({ data: input }),
    onSuccess: (_r, input) => {
      toast.success(input.role === "none" ? "Role removed" : `Role set to ${roleLabel[input.role]}`);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change the role"),
  });

  const rank: Record<Role, number> = { admin: 0, moderator: 1, none: 2 };
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (users.data ?? [])
      .filter((row) => {
        if (filter !== "all" && roleOf(row.id) !== filter) return false;
        return !term || row.displayName.toLowerCase().includes(term) || (row.email ?? "").toLowerCase().includes(term);
      })
      .sort((a, b) => rank[roleOf(a.id)] - rank[roleOf(b.id)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.data, roleById, search, filter]);

  const loading = users.isLoading || roles.isLoading;
  const failed = users.error || roles.error || !users.data;
  const typeName = (row: AdminUserRow) => (row.accountType === "club" ? "Club" : "Player");

  function describe(sel: { row: AdminUserRow; from: Role; to: Role }) {
    const keep = `Their ${typeName(sel.row)} account and profile stay exactly as they are.`;
    if (sel.to === "admin") return `${sel.row.displayName} will get full administrator access. ${keep}`;
    if (sel.to === "moderator")
      return `${sel.row.displayName} will be able to review reports, issue warnings, hide or unhide profiles and apply temporary bans. They won't have full admin access. ${keep}`;
    return `${sel.row.displayName} will lose their ${roleLabel[sel.from]} role and all access to the ${sel.from === "admin" ? "Admin" : "Moderation"} Dashboard. ${keep}`;
  }

  return (
    <AdminShell
      title="Admin Roles"
      description="Set each account's role to Admin, Moderator or No Role. The role is separate from the account type: a Player or Club always stays a Player or Club."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
          <input
            className={adminField}
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={adminField} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Any role</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="none">No Role</option>
          </select>
        </div>

        {loading ? <AdminEmpty>Loading accounts…</AdminEmpty> : failed ? (
          <AdminEmpty>Could not load accounts.</AdminEmpty>
        ) : matches.length === 0 ? <AdminEmpty>No accounts match that search.</AdminEmpty> : (
          <div className="space-y-2">
            {matches.map((row) => {
              const current = roleOf(row.id);
              const isSelf = row.id === adminUser.id;
              return (
                <div key={row.id} className="surface-card grid grid-cols-1 items-center gap-3 rounded-2xl p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <Link to="/admin/users/$profileId" params={{ profileId: row.id }} className="font-semibold text-foreground hover:text-primary">
                      <AccountName verified={row.verification === "verified"} founder={row.isFounderClub} owner={row.isOwner}>{row.displayName}</AccountName>
                      {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                    </Link>
                    {row.email ? <p className="truncate text-xs text-muted-foreground">{row.email}</p> : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">Account type: <TypeBadge type={row.accountType} /></span>
                      <span className="flex items-center gap-1.5">Role: <span className={roleTone[current]}>{roleLabel[current]}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["admin", "moderator", "none"] as Role[]).map((r) => (
                      <Button
                        key={r}
                        size="sm"
                        variant={current === r ? "volt" : "voltOutline"}
                        disabled={mutation.isPending || current === r}
                        onClick={() => setSelected({ row, from: current, to: r })}
                      >
                        {r === "none" ? "No Role" : roleLabel[r]}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={selected !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) setSelected(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selected ? (selected.to === "none" ? `Remove ${roleLabel[selected.from]} role?` : `Change role to ${roleLabel[selected.to]}?`) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{selected ? describe(selected) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.isPending} onClick={(e) => {
              e.preventDefault();
              if (selected) mutation.mutate({ profileId: selected.row.id, role: selected.to });
            }}>
              {mutation.isPending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
