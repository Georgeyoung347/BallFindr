/**
 * Redirect shortcut to the sign-in page.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { type: "player", mode: "signin" } });
  },
});
