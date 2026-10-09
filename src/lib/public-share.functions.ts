/**
 * Server functions for public share pages. Call security-definer get_public_* SQL functions with the publishable key, returning only a fixed safe field set.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

/** Deliberately minimal: no id, location, bio, looking-for, club, height or history. */
export type PublicPlayer = {
  slug: string; name: string; avatarUrl: string | null; isVerified: boolean; isOwner: boolean;
  primaryPosition: string | null; secondaryPositions: string[]; availability: "actively_looking" | "open_to_offers" | "not_looking";
  level: string | null; preferredLevel: string | null; openToTrials: boolean;
};
export type PublicVacancy = {
  id: string; slug: string; title: string | null; positions: string[]; level: string | null; location: string | null;
  description: string | null; requirements: string | null; trainingDays: string[]; matchDay: string | null;
  trialsAvailable: boolean; createdAt: string; isOpen: boolean;
};
export type PublicClub = {
  id: string; slug: string; name: string; shortName: string | null; badgeUrl: string | null; isVerified: boolean; isOwner: boolean;
  isFounderClub: boolean; location: string | null; league: string | null; level: string | null; description: string | null;
  homeGround: string | null; founded: string | null; trainingDays: string[]; matchDay: string | null;
  vacancies?: PublicVacancy[];
};

const slugInput = (data: unknown) => {
  const slug = typeof data === "object" && data && "slug" in data ? String((data as { slug: unknown }).slug) : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { slug: "" };
  return { slug };
};

function publicClient() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Profile images live in a private bucket; sign only the single image path the safe lookup returned. */
async function signImage(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from("profile-images").createSignedUrl(path, 60 * 60 * 24 * 7);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function rpc(fn: "get_public_player" | "get_public_club" | "get_public_vacancy", slug: string) {
  if (!slug) return null;
  const { data, error } = await publicClient().rpc(fn as never, { _slug: slug } as never);
  if (error) throw new Error("This page couldn't be loaded right now.");
  return (data ?? null) as Record<string, unknown> | null;
}

async function shapeClub(raw: Record<string, unknown> | null): Promise<PublicClub | null> {
  if (!raw) return null;
  const { badgePath, ...rest } = raw;
  return { ...(rest as unknown as PublicClub), badgeUrl: await signImage(badgePath) };
}

export const getPublicPlayer = createServerFn({ method: "GET" })
  .inputValidator(slugInput)
  .handler(async ({ data }): Promise<PublicPlayer | null> => {
    const raw = await rpc("get_public_player", data.slug);
    if (!raw) return null;
    const { avatarPath, ...rest } = raw;
    return { ...(rest as unknown as PublicPlayer), avatarUrl: await signImage(avatarPath) };
  });

export const getPublicClub = createServerFn({ method: "GET" })
  .inputValidator(slugInput)
  .handler(async ({ data }) => shapeClub(await rpc("get_public_club", data.slug)));

export const getPublicVacancy = createServerFn({ method: "GET" })
  .inputValidator(slugInput)
  .handler(async ({ data }): Promise<{ vacancy: PublicVacancy; club: PublicClub | null } | null> => {
    const raw = await rpc("get_public_vacancy", data.slug);
    if (!raw) return null;
    return { vacancy: raw["vacancy"] as PublicVacancy, club: await shapeClub(raw["club"] as Record<string, unknown> | null) };
  });
