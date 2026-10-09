/**
 * Real profile views backed by the existing public.profile_views table.
 *
 * Writes: one row per (viewed_profile_id, viewer_profile_id, day). The table's
 * unique index provides the daily de-duplication, so a duplicate insert is
 * swallowed rather than treated as an error. Reads: owners can only select
 * rows where viewed_profile_id = auth.uid() (existing RLS), so the dashboard
 * counts are naturally scoped to the signed-in user.
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isUuid } from "@/lib/applications";

const DUPLICATE = "23505";

async function recordProfileView(viewedProfileId: string, source: string) {
  const { data: auth } = await supabase.auth.getUser();
  const viewer = auth.user?.id;
  // Only genuine signed-in users viewing somebody else's profile.
  if (!viewer || viewer === viewedProfileId) return;

  // Player profiles only count views from club accounts; club profile views
  // are unchanged. The insert policy enforces the same rule server-side.
  const { data: types } = await supabase
    .from("profiles")
    .select("id, account_type")
    .in("id", [viewer, viewedProfileId]);
  const viewerIsClub = types?.some((p) => p.id === viewer && p.account_type === "club");
  const viewedIsClub = types?.some((p) => p.id === viewedProfileId && p.account_type === "club");
  if (!viewerIsClub && !viewedIsClub) return;

  const { error } = await supabase.from("profile_views").insert({
    viewed_profile_id: viewedProfileId,
    viewer_profile_id: viewer,
    source,
  });
  // Same viewer, same profile, same day — the unique index already has it.
  if (error && error.code !== DUPLICATE) {
    console.warn("profile view not recorded", error.message);
  }
}


/** Fire-and-forget: records a view of another user's profile once per mount. */
export function useRecordProfileView(viewedProfileId: string | undefined, source: string) {
  useEffect(() => {
    if (!viewedProfileId || !isUuid(viewedProfileId)) return;
    void recordProfileView(viewedProfileId, source);
  }, [viewedProfileId, source]);
}

async function fetchMyProfileViewCount(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return 0;

  const { count, error } = await supabase
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("viewed_profile_id", user.id);

  if (error) throw error;
  return count ?? 0;
}

/** Total real views of the signed-in user's own profile. */
export function useMyProfileViewCount() {
  return useQuery({
    queryKey: ["profile-views", "count", "me"],
    queryFn: fetchMyProfileViewCount,
    staleTime: 60_000,
  });
}
