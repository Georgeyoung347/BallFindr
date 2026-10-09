import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  Bookmark,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Search,
  Shield,
  Star,
  CalendarCheck,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { RestrictedNotice } from "@/components/app/RestrictedNotice";
import { SectionSwitcher } from "@/components/app/SectionSwitcher";

import { supabase } from "@/integrations/supabase/client";
import { useSignedInClubProfile } from "@/lib/club-profile";

const nav: NavItem[] = [
  { label: "Dashboard", to: "/club", icon: LayoutDashboard, exact: true },
  { label: "Find Players", to: "/club/find-players", icon: Search },
  { label: "Vacancies", to: "/club/vacancies", icon: Megaphone },
  { label: "Applications", to: "/club/applications", icon: ClipboardList },
  { label: "Invited to Trial", to: "/club/trials", icon: CalendarCheck },
  { label: "Shortlist", to: "/club/shortlist", icon: Star },
  { label: "Saved Players", to: "/club/saved-players", icon: Bookmark },
  { label: "Club Profile", to: "/club/profile", icon: Shield },
];

export const Route = createFileRoute("/club")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { type: "club", mode: "signin" } });
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
        : ((data.user.user_metadata?.['account_type'] as string | undefined) ?? "player");
    if (accountType !== "club") {
      throw redirect({ to: "/player" });
    }
    return { authUser: data.user };
  },
  component: ClubLayout,
});

function ClubLayout() {
  const { authUser } = Route.useRouteContext();
  const { data: club } = useSignedInClubProfile();
  const name =
    club?.name ||
    (authUser.user_metadata?.['display_name'] as string | undefined) ||
    "Your Club";
  const meta = [club?.level, club?.location].filter(Boolean).join(" • ");

  return (
    <AppShell
      role="club"
      nav={nav}
      messagesTo="/club/messages"
      user={{
        name,
        initials: club?.short ?? "YC",
        meta: meta || "Club account",
        imageUrl: club?.badgeUrl,
        isVerified: club?.isVerified,
        isOwner: club?.isOwner,
        isFounderClub: club?.isFounderClub,
      }}
    >
      <SectionSwitcher />
      <RestrictedNotice />
      <Outlet />
    </AppShell>
  );
}
