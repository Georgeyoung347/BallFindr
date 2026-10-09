/**
 * Redirect shortcut into club sign-up.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

// "I'm a Club" now starts real signup with the club account type preselected.
export const Route = createFileRoute("/join/club")({
  staticData: { sitemap: true },
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { type: "club", mode: "signup" } });
  },
});
