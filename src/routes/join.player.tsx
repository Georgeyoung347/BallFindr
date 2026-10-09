/**
 * Redirect shortcut into player sign-up.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

// "I'm a Player" now starts real signup with the player account type preselected.
export const Route = createFileRoute("/join/player")({
  staticData: { sitemap: true },
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { type: "player", mode: "signup" } });
  },
});
