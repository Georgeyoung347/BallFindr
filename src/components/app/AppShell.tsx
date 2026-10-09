/**
 * Signed-in layout for Player and Club areas: desktop sidebar, mobile drawer, notification bell (realtime via lib/notifications), messages link, social links, Settings cog and Sign out. Used by routes/player.tsx and routes/club.tsx.
 */
import { deactivateCurrentDevice, registerCurrentDevice, startPushTapListener, onPushTap } from "@/lib/push-devices";
import { PushPermissionPrompt } from "@/components/app/PushPermissionPrompt";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, MessageSquare, LogOut, X, Menu, ShieldCheck, Settings } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStatus } from "@/lib/admin.functions";
import { Logo } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";
import {
  useNotifications,
  useNotificationsRealtime,
  useMarkNotificationsRead,
  fetchNotifications,
  notificationHref,
  relativeTime,
} from "@/lib/notifications";
import { Toaster } from "@/components/ui/sonner";
import { useMessagingRealtime, useUnreadMessageCount } from "@/lib/messaging";
import { cn } from "@/lib/utils";
import { handleInstagramClick } from "@/lib/instagram";
import { Avatar } from "@/components/app/ui";
import { AccountName } from "@/components/app/AccountName";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/ball.findr/",
    path: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@ballfindr",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  {
    label: "X",
    href: "https://x.com/ballfindr",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  {
    label: "YouTube",
    href: null,
    path: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
] as const;

function SocialBubbleRow() {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-border px-3 pt-4 pb-1">
      {SOCIAL_LINKS.map((social) => {
        const icon = (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4">
            <path d={social.path} />
          </svg>
        );
        const bubbleClass = cn(
          "grid size-9 place-items-center rounded-full border transition-colors",
          social.href
            ? "border-border bg-elevated/60 text-muted-foreground hover:border-primary/50 hover:text-primary"
            : "border-border bg-elevated/60 text-muted-foreground/70",
        );
        return social.href ? (
          <a
            key={social.label}
            href={social.href}
            onClick={social.label === "Instagram" ? handleInstagramClick : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`BallFindr on ${social.label}`}
            title={`BallFindr on ${social.label}`}
            className={bubbleClass}
          >
            {icon}
          </a>
        ) : (
          <span
            key={social.label}
            aria-label={`BallFindr on ${social.label} (coming soon)`}
            title={`BallFindr on ${social.label}`}
            className={bubbleClass}
          >
            {icon}
          </span>
        );
      })}
    </div>
  );
}

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: number;
}

export interface ShellUser {
  name: string;
  initials: string;
  meta: string;
  imageUrl?: string | null | undefined;
  isVerified?: boolean | undefined;
  isOwner?: boolean | undefined;
  isFounderClub?: boolean | undefined;
}

function useActive(to: string, exact?: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

function SidebarLink({ item }: { item: NavItem }) {
  const active = useActive(item.to, item.exact);
  const Icon = item.icon;
  return (
    <Link
      to={item.to as never}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-elevated hover:text-foreground",
      )}
    >
      <Icon className="size-4.5" />
      {item.label}
      {item.badge && item.badge > 0 ? (
        <span
          className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
          aria-label={`${item.badge} pending`}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function BottomLink({ item }: { item: NavItem }) {
  const active = useActive(item.to, item.exact);
  const Icon = item.icon;
  return (
    <Link
      to={item.to as never}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold tracking-wide uppercase transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg transition-colors",
          active && "bg-primary/10",
        )}
      >
        <Icon className="size-5" />
      </span>
      {item.label}
    </Link>
  );
}

function NotificationsBell({ role }: { role: "player" | "club" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: items = [], isLoading, refetch } = useNotifications();
  useNotificationsRealtime();
  const markRead = useMarkNotificationsRead();
  const unread = items.filter((n) => !n.readAt);

  useEffect(() => {
    if (!open) return;
    void refetch();
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refetch]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative grid size-9 place-items-center rounded-xl border transition-colors",
          open
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border bg-elevated/60 text-muted-foreground hover:text-foreground",
        )}
      >
        <Bell className="size-4.5" />
        {unread.length > 0 ? (
          <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unread.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-popover)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase">Notifications</p>
            {unread.length > 0 ? (
              <button
                type="button"
                onClick={() => markRead.mutate(unread.map((n) => n.id))}
                className="text-[11px] font-medium text-primary transition-colors hover:brightness-125"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {isLoading ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const isRead = Boolean(n.readAt);
                const href = notificationHref(n, role);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isRead) markRead.mutate([n.id]);
                        if (href) {
                          setOpen(false);
                          void navigate({
                            to: href.to,
                            params: href.params,
                            search: href.search,
                            hash: href.hash,
                          } as never);
                        }
                      }}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated/60",
                        isRead ? "opacity-60" : "bg-elevated/30",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          isRead ? "bg-border" : "bg-primary",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{n.title}</span>
                        {n.body ? (
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[10px] tracking-wide text-muted-foreground/70 uppercase">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}


export function AppShell({
  nav,
  user,
  messagesTo,
  role,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  messagesTo: string;
  role: "player" | "club";
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const homeTo = role === "club" ? "/club" : "/player";
  const profileTo = role === "club" ? "/club/profile" : "/player/profile";
  const settingsTo = role === "club" ? "/club/settings" : "/player/settings";
  const navigate = useNavigate();
  useMessagingRealtime();
  const { data: unreadMessages = 0 } = useUnreadMessageCount();
  // Menu visibility only; /admin is still protected server-side by is_admin().
  const fetchAdminStatus = useServerFn(getAdminStatus);
  const { data: adminStatus } = useQuery({
    queryKey: ["me", "admin-status"],
    queryFn: () => fetchAdminStatus(),
    staleTime: 60_000,
  });
  const adminLink = adminStatus?.isAdmin
    ? <SidebarLink item={{ label: "Admin Dashboard", to: "/admin", icon: ShieldCheck, exact: true }} />
    : adminStatus?.isModerator
      ? <SidebarLink item={{ label: "Moderation Dashboard", to: "/admin/reports", icon: ShieldCheck }} />
      : null;
  // Three-line menu "Notifications" reminder: shown only when all four categories are OFF.
  // Shares the ["notification-preferences"] cache with the Settings section, so visibility
  // updates immediately when preferences change. No row (defaults all ON) or fetch error hides it.
  const { data: notifPrefs } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("messages, applications, trials, recruitment")
        .eq("profile_id", u.user.id)
        .maybeSingle();
      return data ?? null;
    },
  });
  const allNotificationsOff =
    !!notifPrefs && !notifPrefs.messages && !notifPrefs.applications && !notifPrefs.trials && !notifPrefs.recruitment;
  // Native app only: register this device's push token for the signed-in account
  // (no-op in browsers or when permission hasn't been granted yet).
  useEffect(() => {
    void registerCurrentDevice();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void registerCurrentDevice();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  // Native app only: tapping a phone push opens the same destination as the
  // matching in-app notification (same lookup, mark-read and notificationHref).
  const queryClient = useQueryClient();
  const markPushRead = useMarkNotificationsRead();
  useEffect(() => {
    startPushTapListener();
    return onPushTap((id) => {
      void (async () => {
        try {
          const items = await queryClient.fetchQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, staleTime: 0 });
          const n = items.find((x) => x.id === id);
          if (!n) return;
          if (!n.readAt) markPushRead.mutate([n.id]);
          const href = notificationHref(n, role);
          if (href) {
            void navigate({ to: href.to, params: href.params, search: href.search, hash: href.hash } as never);
          }
        } catch {
          /* stay on the current page */
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, queryClient, navigate]);
  const signOut = async () => {
    await deactivateCurrentDevice();
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  };
  const bottomNav = nav.slice(0, 4).concat([
    { label: "Messages", to: messagesTo, icon: MessageSquare },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <PushPermissionPrompt />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar px-4 py-5 lg:flex">
        <Logo to={homeTo} />
        <p className="mt-1 pl-9 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {role === "player" ? "Player" : "Club"}
        </p>

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
          {nav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          <SidebarLink item={{ label: "Messages", to: messagesTo, icon: MessageSquare }} />
          {adminLink}
        </nav>

        <div className="rounded-xl border border-border bg-elevated/50 p-3">
          <div className="flex items-center gap-3">
            <Avatar initials={user.initials} imageUrl={user.imageUrl} alt={`${user.name} profile image`} className="size-9 rounded-lg text-xs" />
            <div className="min-w-0">
              <p className="text-sm font-semibold"><AccountName verified={user.isVerified} owner={user.isOwner} founder={user.isFounderClub}>{user.name}</AccountName></p>
              <p className="truncate text-xs text-muted-foreground">{user.meta}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
            <Link
              to={settingsTo as never}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings className="size-3.5" /> Settings
            </Link>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:pl-64">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="grid size-9 place-items-center rounded-xl border border-border bg-elevated/60"
            >
              <Menu className="size-4.5" />
            </button>
            <Logo to={homeTo} />
          </div>

          <div className="hidden text-xs tracking-[0.18em] text-muted-foreground uppercase lg:block">
            {role === "player" ? "Player workspace" : "Club workspace"}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={messagesTo as never}
              aria-label="Messages"
              className="relative grid size-9 place-items-center rounded-xl border border-border bg-elevated/60 text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquare className="size-4.5" />
              {unreadMessages > 0 ? (
                <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              ) : null}
            </Link>
            <NotificationsBell role={role} />
            <Link
              to={profileTo as never}
              aria-label="Go to your profile"
              title="Your profile"
              className="inline-flex shrink-0 cursor-pointer rounded-lg transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Avatar initials={user.initials} imageUrl={user.imageUrl} alt={`${user.name} profile image`} className="size-9 text-xs" />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-sidebar p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <Logo to={homeTo} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="grid size-9 place-items-center rounded-xl border border-border"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <nav
              className="mt-6 flex flex-1 flex-col gap-1"
              aria-label="Mobile"
              onClick={() => setMenuOpen(false)}
            >
              {nav.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
              <SidebarLink item={{ label: "Messages", to: messagesTo, icon: MessageSquare }} />
              {adminLink}
            </nav>
            {allNotificationsOff ? (
              <Link
                to={settingsTo as never}
                hash="notifications"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground"
              >
                <Bell className="size-4" /> Notifications
              </Link>
            ) : null}
            <SocialBubbleRow />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 px-3 text-xs text-muted-foreground"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="size-3.5" /> Sign out
              </button>
              <Link
                to={settingsTo as never}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center gap-2 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <Settings className="size-4" /> Settings
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:pb-12 lg:pl-70">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Bottom"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {bottomNav.map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
      </nav>

      <Toaster position="top-center" />
    </div>
  );
}
