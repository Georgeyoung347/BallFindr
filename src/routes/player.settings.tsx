/**
 * Player > Settings (renders the shared SettingsPage).
 */
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const Route = createFileRoute("/player/settings")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Settings — BallFindr" },
      { name: "description", content: "Manage your BallFindr appearance, notifications, login and account." },
      { property: "og:title", content: "Settings — BallFindr" },
      { property: "og:description", content: "Manage your BallFindr appearance, notifications, login and account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <SettingsPage accountType="player" />,
});
