import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Bookmark, FileText, Home, Search, Ticket, UserRound, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { RestrictedNotice } from "@/components/app/RestrictedNotice";
import { useSignedInPlayerProfile } from "@/lib/player-profile";
import { trialDisplayStatus, useMyTrialInvites } from "@/lib/trial-invites";
import { supabase } from "@/integrations/supabase/client";

const baseNav: NavItem[] = [
  { label: "Home", to: "/player", icon: Home, exact: true },
  { label: "Find Clubs", to: "/player/find-clubs", icon: Search },
  { label: "Find Players", to: "/player/find-players", icon: Users },
  { label: "Saved", to: "/player/saved", icon: Bookmark },
  { label: "Applications", to: "/player/applications", icon: FileText },
  { label: "Trial Invites", to: "/player/trials", icon: Ticket },
  { label: "Profile", to: "/player/profile", icon: UserRound },
];

export const Route = createFileRoute("/player")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { type: "player", mode: "signin" } });
    }
    // Route by the real type on the profile; fall back to the signup copy if it can't load.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", data.user.id)
      .maybeSingle();
    const accountType =
      !profileError && profile?.account_type
        ? profile.account_type
        : (data.user.user_metadata?.['account_type'] as string | undefined);
    if (accountType === "club") {
      throw redirect({ to: "/club" });
    }
    return { authUser: data.user };
  },
  component: PlayerLayout,
});

function PlayerLayout() {
  const { authUser } = Route.useRouteContext();
  const { data: profile } = useSignedInPlayerProfile();
  const { data: invites = [] } = useMyTrialInvites();
  const pendingInvites = invites.filter((i) => trialDisplayStatus(i) === "awaiting").length;
  const nav = baseNav.map((item) =>
    item.to === "/player/trials" ? { ...item, badge: pendingInvites } : item,
  );

  const name =
    profile?.fullName ||
    (authUser.user_metadata?.['display_name'] as string | undefined) ||
    authUser.email ||
    "Player";
  const initials = profile?.initials ?? name.slice(0, 2).toUpperCase();
  const meta =
    [
      [profile?.primaryPosition, ...(profile?.secondaryPositions ?? [])].filter(Boolean).join(" / "),
      profile?.currentLevel,
    ]
      .filter(Boolean)
      .join(" • ") || "Complete your profile";

  return (
    <AppShell
      role="player"
      nav={nav}
      messagesTo="/player/messages"
      user={{ name, initials, meta, imageUrl: profile?.photoUrl, isVerified: profile?.isVerified, isOwner: profile?.isOwner }}
    >
      <RestrictedNotice />
      <Outlet />
    </AppShell>
  );
}
