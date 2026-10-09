/**
 * Public endpoint serving social preview images. Re-checks the public profile lookup, then streams only that record's photo/badge from private storage; otherwise the branded fallback.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { FALLBACK_SHARE_IMAGE } from "@/lib/share";
import { isSafeStoragePath } from "@/lib/storage-paths";

/**
 * Permanent social-preview image for a public player photo or club badge.
 * Every request re-runs the same safe public lookup the share page uses, so
 * hidden, restricted, deleted and admin accounts never get an image served —
 * they fall back to the BallFindr banner. Only the single image path that
 * lookup returns is read from the private bucket; nothing else is reachable.
 */
export const Route = createFileRoute("/api/public/share-image/$kind/$slug")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ params }) => {
        const fallback = () => Response.redirect(FALLBACK_SHARE_IMAGE, 302);
        const { kind, slug } = params;
        if ((kind !== "player" && kind !== "club") || !/^[a-z0-9-]{1,80}$/.test(slug)) return fallback();
        try {
          const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const fn = kind === "player" ? "get_public_player" : "get_public_club";
          const { data, error } = await pub.rpc(fn as never, { _slug: slug } as never);
          const raw = (data ?? null) as Record<string, unknown> | null;
          const path = raw?.[kind === "player" ? "avatarPath" : "badgePath"];
          // Club lookups include the owner id; player lookups deliberately do not.
          const ownerId = kind === "club" && typeof raw?.["id"] === "string" ? raw["id"] : null;
          if (error || !isSafeStoragePath(path, ownerId)) return fallback();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: file } = await supabaseAdmin.storage.from("profile-images").download(path);
          if (!file || !file.type.startsWith("image/")) return fallback();
          return new Response(file, {
            headers: {
              "Content-Type": file.type,
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return fallback();
        }
      },
    },
  },
});
