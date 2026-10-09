/**
 * Sharing helpers: builds permanent public URLs and useShareSlug() which looks up a record's slug (player_share_slugs / club_share_slugs views, vacancies table).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import socialImage from "@/assets/ballfindr-social.jpg.asset.json";

export const SITE_URL = "https://ballfindr.co.uk";
export const FALLBACK_SHARE_IMAGE = `${SITE_URL}${socialImage.url}`;

export type ShareKind = "player" | "club" | "vacancy";
const prefix: Record<ShareKind, string> = { player: "/players/", club: "/clubs/", vacancy: "/vacancies/" };
export const sharePath = (kind: ShareKind, slug: string) => `${prefix[kind]}${slug}`;
export const shareUrl = (kind: ShareKind, slug: string) => `${SITE_URL}${sharePath(kind, slug)}`;

/** Builds the shared head() tags for a public page. */
/** Permanent preview-image address; served by the share-image server route. */
export const shareImageUrl = (kind: "player" | "club", slug: string) => `${SITE_URL}/api/public/share-image/${kind}/${slug}`;

export function shareHead(o: { title: string; description: string; path: string; image?: string | null; type?: string }) {
  const url = `${SITE_URL}${o.path}`;
  const image = o.image || FALLBACK_SHARE_IMAGE;
  return {
    meta: [
      { title: o.title },
      { name: "description", content: o.description },
      { property: "og:title", content: o.title },
      { property: "og:description", content: o.description },
      { property: "og:url", content: url },
      { property: "og:type", content: o.type ?? "website" },
      { property: "og:site_name", content: "BallFindr" },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: o.title },
      { name: "twitter:description", content: o.description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

/** Looks up the public link name for a record a signed-in member can already read. */
export function useShareSlug(kind: ShareKind, id: string | null | undefined) {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    // Players/clubs read the slug-only views (id + public link name only);
    // vacancies keep their existing member-readable table.
    const table = kind === "player" ? "player_share_slugs" : kind === "club" ? "club_share_slugs" : "vacancies";
    let cancelled = false;
    void supabase
      .from(table as never)
      .select("slug" as never)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const value = (data as { slug?: string } | null)?.slug;
        if (!cancelled && value) setSlug(value);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);
  return slug;
}

// ---- Return-to-page after sign up / sign in ----
const RETURN_KEY = "bf_return_to";
const RETURN_TTL_MS = 1000 * 60 * 60 * 24;

const safePath = (p: unknown): p is string =>
  typeof p === "string" && /^\/(players|clubs|vacancies)\/[a-z0-9-]{1,80}(\?[\w=&-]*)?$/.test(p);

export function rememberReturnTo(path: string) {
  if (!safePath(path)) return;
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

/** Reads and clears the saved shared page, if any and still fresh. */
export function takeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    localStorage.removeItem(RETURN_KEY);
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: number };
    if (!safePath(path) || !at || Date.now() - at > RETURN_TTL_MS) return null;
    return path;
  } catch {
    return null;
  }
}
