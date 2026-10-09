/**
 * Scrolls to and briefly highlights the list item named in the URL hash (used by notification deep links).
 */
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Scrolls to and briefly highlights the element named by the URL hash
 * (e.g. #application-<id>) once the list has rendered. Used by notification links.
 * Re-runs when the router hash changes, e.g. a second notification link to the
 * list that is already open.
 */
export function useHashHighlight(prefix: string, readyKey: string) {
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = (hash || window.location.hash).replace(/^#/, "");
    if (!h.startsWith(prefix)) return;
    const el = document.getElementById(h);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const t = window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    return () => window.clearTimeout(t);
  }, [prefix, readyKey, hash]);
}
