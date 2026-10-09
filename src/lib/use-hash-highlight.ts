/**
 * Scrolls to and briefly highlights the list item named in the URL hash (used by notification deep links).
 */
import { useEffect } from "react";

/**
 * Scrolls to and briefly highlights the element named by the URL hash
 * (e.g. #application-<id>) once the list has rendered. Used by notification links.
 */
export function useHashHighlight(prefix: string, readyKey: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.replace(/^#/, "");
    if (!h.startsWith(prefix)) return;
    const el = document.getElementById(h);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const t = window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    return () => window.clearTimeout(t);
  }, [prefix, readyKey]);
}
