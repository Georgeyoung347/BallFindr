/**
 * Shared building blocks for the admin area.
 *
 * The route guard here is convenience only: real enforcement lives in the
 * database (user_roles + is_admin()) and in every admin server function.
 */

import { deactivateCurrentDevice } from "@/lib/push-devices";
import { useEffect, useState, type ReactNode } from "react";
import { Link, redirect, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Flag,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  Star,
  Crown,
  UserRound,
  Users,
  KeyRound,
  ArrowLeft,
  History,
  Handshake,
  Ticket,
  MessagesSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminReportStatus, AdminVerification } from "@/lib/admin-data.functions";

/** Admin-only pages. Moderators are sent to the Reports page instead. */
export async function adminBeforeLoad() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/admin/login" });
  const status = await getAdminStatus().catch(() => ({ isAdmin: false, isModerator: false }));
  if (status.isModerator) throw redirect({ to: "/admin/reports" });
  if (!status.isAdmin) throw redirect({ to: "/admin/login" });
  return { adminUser: data.user, staffRole: "admin" as "admin" | "moderator" };
}

/** Moderation pages: open to admins and moderators. */
export async function staffBeforeLoad() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/admin/login" });
  const status = await getAdminStatus().catch(() => ({ isAdmin: false, isModerator: false }));
  if (!status.isAdmin && !status.isModerator) throw redirect({ to: "/admin/login" });
  return { adminUser: data.user, staffRole: (status.isAdmin ? "admin" : "moderator") as "admin" | "moderator" };
}

/** The signed-in staff member's role, for showing/hiding controls only. */
export function useStaffRole(): "admin" | "moderator" | null {
  const fetchStatus = useServerFn(getAdminStatus);
  const { data } = useQuery({ queryKey: ["me", "admin-status"], queryFn: () => fetchStatus(), staleTime: 60_000 });
  return data?.role ?? null;
}

export function adminHead(title: string) {
  const full = `${title} · BallFindr Admin`;
  return {
    meta: [
      { title: full },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private BallFindr administration area." },
      { property: "og:title", content: full },
      { property: "og:description", content: "Private BallFindr administration area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

// `staff: true` = also open to moderators. Everything else is admin-only.
const navItems = [
  { label: "Overview", to: "/admin", icon: Home, exact: true },
  { label: "Users", to: "/admin/users", icon: Users, staff: true },
  { label: "Clubs", to: "/admin/clubs", icon: ShieldCheck, staff: true },
  { label: "Players", to: "/admin/players", icon: UserRound, staff: true },
  { label: "Verification", to: "/admin/verification", icon: BadgeCheck },
  { label: "Owner Status", to: "/admin/owner-status", icon: Crown },
  { label: "Reports", to: "/admin/reports", icon: Flag, staff: true },
  { label: "Founder Clubs", to: "/admin/founder-clubs", icon: Star },
  { label: "Admin Roles", to: "/admin/roles", icon: KeyRound },
  { label: "Successful Connections", to: "/admin/connections", icon: Handshake },
  { label: "Trial Invites", to: "/admin/trials", icon: Ticket },
  { label: "Conversations", to: "/admin/conversations", icon: MessagesSquare },
  { label: "Action History", to: "/admin/history", icon: History, staff: true },
  { label: "Settings", to: "/admin/settings", icon: Settings },
] as const;

export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const staffRole = useStaffRole();
  const visibleNav = staffRole === "moderator" ? navItems.filter((i) => "staff" in i && i.staff) : navItems;
  const [memberHome, setMemberHome] = useState<"/player" | "/club" | null>(null);

  // Admin is a role on a normal Player/Club account: offer a way back to it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("account_type").eq("id", auth.user.id).maybeSingle();
      if (cancelled || !data) return;
      setMemberHome(data.account_type === "club" ? "/club" : "/player");
    })();
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    await deactivateCurrentDevice();
    await supabase.auth.signOut();
    void navigate({ to: "/admin/login", replace: true });
  }

  return (
    // Same top safe-area inset as AppShell so installed-app content clears the iPhone status bar.
    <div className="min-h-screen bg-background text-foreground pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8 lg:py-10">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="flex items-center gap-2 px-1 pb-4">
            <ShieldCheck className="size-5 text-primary" />
            <span className="font-display text-sm uppercase tracking-wide">
              {staffRole === "moderator" ? "BallFindr Moderation" : "BallFindr Admin"}
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {visibleNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: "exact" in item ? item.exact : false }}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{
                  className:
                    "border-primary/40 bg-primary/10 text-primary hover:text-primary",
                }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          {memberHome ? (
            <Link
              to={memberHome}
              className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to {memberHome === "/club" ? "Club" : "Player"} account
            </Link>
          ) : null}
          <div className="mt-4 hidden lg:block">
            <Button variant="voltOutline" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
            <div>
              <p className="eyebrow">Restricted</p>
              <h1 className="mt-1 text-2xl uppercase sm:text-3xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <Button variant="voltOutline" size="sm" className="lg:hidden" onClick={signOut}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </header>
          <div className="pt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export const adminField =
  "w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("surface-card rounded-2xl p-5", className)}>{children}</div>;
}

export function AdminStat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="surface-card rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const verificationStyles: Record<AdminVerification, string> = {
  verified: "border-primary/40 bg-primary/10 text-primary",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  unverified: "border-border bg-elevated/60 text-muted-foreground",
};

export const verificationLabels: Record<AdminVerification, string> = {
  verified: "Verified",
  pending: "Awaiting review",
  rejected: "Rejected",
  unverified: "Not verified",
};

export function VerificationBadge({ status }: { status: AdminVerification }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        verificationStyles[status],
      )}
    >
      {verificationLabels[status]}
    </span>
  );
}

const reportStyles: Record<AdminReportStatus, string> = {
  open: "border-destructive/40 bg-destructive/10 text-destructive",
  resolved: "border-primary/40 bg-primary/10 text-primary",
  dismissed: "border-border bg-elevated/60 text-muted-foreground",
};

export const reportLabels: Record<AdminReportStatus, string> = {
  open: "Outstanding",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function ReportBadge({ status }: { status: AdminReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        reportStyles[status],
      )}
    >
      {reportLabels[status]}
    </span>
  );
}

export function TypeBadge({ type }: { type: "player" | "club" | null }) {
  if (!type) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        type === "club"
          ? "border-foreground/25 bg-foreground/10 text-foreground"
          : "border-primary/30 bg-primary/5 text-primary",
      )}
    >
      {type}
    </span>
  );
}

export type AdminSectionFilter = "all" | "mens" | "womens";

/**
 * Does this account belong in the selected filter? A club that operates both
 * sections appears in the Men's view and the Women's view.
 */
export function matchesSectionFilter(
  section: "mens" | "womens" | "both" | null,
  filter: AdminSectionFilter,
): boolean {
  if (filter === "all") return true;
  return section === filter || section === "both";
}

/** Small Men's / Women's / Both label used across the admin screens. */
export function SectionBadge({ section }: { section: "mens" | "womens" | "both" | null }) {
  if (!section) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        section === "womens"
          ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
          : section === "both"
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
      )}
    >
      {section === "womens" ? "Women's" : section === "both" ? "Men's & Women's" : "Men's"}
    </span>
  );
}

/** Shared All / Men's / Women's dropdown. */
export function SectionFilter({
  value,
  onChange,
  className,
}: {
  value: AdminSectionFilter;
  onChange: (value: AdminSectionFilter) => void;
  className?: string;
}) {
  return (
    <select
      aria-label="Football section"
      className={cn(adminField, className)}
      value={value}
      onChange={(e) => onChange(e.target.value as AdminSectionFilter)}
    >
      <option value="all">All sections</option>
      <option value="mens">Men's Football</option>
      <option value="womens">Women's Football</option>
    </select>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="surface-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** The signed-in admin's own account type (admin is a role on a Player or Club account). */
function useViewerAccountType() {
  const [type, setType] = useState<"player" | "club" | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("account_type").eq("id", auth.user.id).maybeSingle();
      if (!cancelled && data) setType(data.account_type === "club" ? "club" : "player");
    })();
    return () => { cancelled = true; };
  }, []);
  return type;
}

/**
 * Link to a specific target account's existing public profile. The route is chosen
 * from the viewer's own workspace (player/club layouts redirect the other type),
 * while the target ID always comes from the admin record.
 */
export function PublicProfileLink({
  targetId, targetType, className,
}: { targetId: string; targetType: "player" | "club"; className?: string }) {
  const viewer = useViewerAccountType();
  if (!viewer) return null;
  const label = targetType === "club" ? "Open → Public Club Profile" : "Open → Public Player Profile";
  if (targetType === "club") {
    return viewer === "club"
      ? <Link to="/club/clubs/$clubId" params={{ clubId: targetId }} className={className}>{label}</Link>
      : <Link to="/player/clubs/$clubId" params={{ clubId: targetId }} className={className}>{label}</Link>;
  }
  return viewer === "club"
    ? <Link to="/club/players/$playerId" params={{ playerId: targetId }} className={className}>{label}</Link>
    : <Link to="/player/players/$playerId" params={{ playerId: targetId }} className={className}>{label}</Link>;
}
