/**
 * Media reactions (🔥 👍 👀): queries/mutations to read counts and add/replace/remove the viewer's reaction. RLS blocks reacting to own media; the DB notifies clip owners.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReactionKind = "fire" | "thumbs_up" | "eyes";
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "fire", emoji: "🔥", label: "Fire" },
  { kind: "thumbs_up", emoji: "👍", label: "Thumbs up" },
  { kind: "eyes", emoji: "👀", label: "Eyes" },
];

export interface MediaReactionSummary {
  counts: Record<ReactionKind, number>;
  mine: ReactionKind | null;
}

export type ReactionMap = Record<string, MediaReactionSummary>;

const empty = (): MediaReactionSummary => ({ counts: { fire: 0, thumbs_up: 0, eyes: 0 }, mine: null });
const key = (ids: string[]) => ["media-reactions", [...ids].sort().join(",")];

export function useMediaReactions(mediaIds: string[]) {
  return useQuery({
    queryKey: key(mediaIds),
    enabled: mediaIds.length > 0,
    queryFn: async (): Promise<{ map: ReactionMap; userId: string | null }> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      const { data, error } = await supabase
        .from("media_reactions" as never)
        .select("media_id, profile_id, reaction")
        .in("media_id", mediaIds);
      if (error) throw error;
      const map: ReactionMap = {};
      for (const id of mediaIds) map[id] = empty();
      for (const r of (data ?? []) as { media_id: string; profile_id: string; reaction: ReactionKind }[]) {
        const s = (map[r.media_id] ??= empty());
        s.counts[r.reaction] = (s.counts[r.reaction] ?? 0) + 1;
        if (r.profile_id === userId) s.mine = r.reaction;
      }
      return { map, userId };
    },
  });
}

/** Sets, changes, or (when the same reaction is chosen again) removes the user's reaction. */
export function useSetMediaReaction(mediaIds: string[]) {
  const qc = useQueryClient();
  const qk = key(mediaIds);
  return useMutation({
    mutationFn: async ({ mediaId, reaction, current, userId }: { mediaId: string; reaction: ReactionKind; current: ReactionKind | null; userId: string }) => {
      const table = supabase.from("media_reactions" as never);
      if (current === reaction) {
        const { error } = await table.delete().eq("media_id", mediaId).eq("profile_id", userId);
        if (error) throw error;
      } else {
        const { error } = await table.upsert(
          { media_id: mediaId, profile_id: userId, reaction } as never,
          { onConflict: "media_id,profile_id" },
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ mediaId, reaction, current }) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<{ map: ReactionMap; userId: string | null }>(qk);
      if (prev) {
        const s = prev.map[mediaId] ?? empty();
        const counts = { ...s.counts };
        if (current) counts[current] = Math.max(0, counts[current] - 1);
        const next = current === reaction ? null : reaction;
        if (next) counts[next] += 1;
        qc.setQueryData(qk, { ...prev, map: { ...prev.map, [mediaId]: { counts, mine: next } } });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk }),
  });
}
