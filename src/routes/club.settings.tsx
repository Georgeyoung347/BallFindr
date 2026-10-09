/**
 * Club > Settings (renders the shared SettingsPage).
 */
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const Route = createFileRoute("/club/settings")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Club Settings — BallFindr" },
      { name: "description", content: "Manage your club's BallFindr appearance, notifications, login and account." },
      { property: "og:title", content: "Club Settings — BallFindr" },
      { property: "og:description", content: "Manage your club's BallFindr appearance, notifications, login and account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <SettingsPage accountType="club" />,
});
