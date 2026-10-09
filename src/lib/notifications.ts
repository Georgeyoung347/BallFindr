/**
 * Real notifications backed by the existing public.notifications table.
 *
 * Rows are created by the existing database triggers (on_application_insert and
 * on_application_stage_change). Nothing here inserts notifications — the app
 * only reads them and marks them read.
 *
 * Security relies on the existing RLS: users may only SELECT rows where
 * recipient_profile_id = auth.uid(), and may only UPDATE their own rows.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
  /** Owning club of a vacancy notification, resolved for navigation only. */
  clubId?: string | null;
  /** Account side this notification was created for; "missing" = target gone. */
  forRole?: "player" | "club" | "missing" | null;
}


async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity_type, entity_id, read_at, created_at")
    .eq("recipient_profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = data ?? [];

  // Vacancy notifications need their club to build the opportunity link.
  const vacancyIds = Array.from(
    new Set(
      rows
        .filter((n) => n.entity_type === "vacancy" && n.entity_id)
        .map((n) => n.entity_id as string),
    ),
  );
  const clubByVacancy = new Map<string, string>();
  if (vacancyIds.length) {
    const { data: vacancies } = await supabase
      .from("vacancies")
      .select("id, club_id")
      .in("id", vacancyIds);
    for (const v of vacancies ?? []) clubByVacancy.set(v.id, v.club_id);
  }

  // Which side of each conversation this user was on (survives account switches).
  const convIds = Array.from(
    new Set(
      rows
        .filter((n) => n.entity_type === "conversation" && n.entity_id)
        .map((n) => n.entity_id as string),
    ),
  );
  const convSide = new Map<string, "player" | "club">();
  if (convIds.length) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, club_id, player_id")
      .in("id", convIds);
    for (const c of convs ?? []) {
      convSide.set(c.id, c.club_id === userId ? "club" : "player");
    }
  }

  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entity_type,
    entityId: n.entity_id,
    readAt: n.read_at,
    createdAt: n.created_at,
    clubId: n.entity_id ? (clubByVacancy.get(n.entity_id) ?? null) : null,
    forRole:
      n.entity_type === "conversation"
        ? n.entity_id
          ? (convSide.get(n.entity_id) ?? "missing")
          : "missing"
        : (NOTIFICATION_ROLE[n.type] ?? null),
  }));
}

/**
 * The account side each notification type was created for. Used so that
 * history from before a Player <-> Club switch never opens the other side's pages.
 */
const NOTIFICATION_ROLE: Record<string, "player" | "club"> = {
  trial_invite: "player",
  trial_cancelled: "player",
  trial_outcome: "player",
  application_withdrawn: "club",
  stage_change: "player",
  saved_club_new_vacancy: "player",
  saved_club_vacancy_closed: "player",
  saved_club_vacancy_updated: "player",
  media_reaction: "player",
  new_interest: "club",
  trial_response: "club",
  saved_player_availability: "club",
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 15_000,
  });
}

/**
 * Instant bell updates. The channel is filtered to the signed-in user's own
 * rows and RLS still decides what is delivered; events only trigger a refetch
 * through fetchNotifications, which stays the source of truth (no duplicates).
 * Focus/open refetching remains the fallback if the socket drops.
 */
export function useNotificationsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void currentUserId().then((uid) => {
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${uid}` },
          () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [qc]);
}

async function markRead(ids: string[]) {
  const userId = await currentUserId();
  if (!userId || !ids.length) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_profile_id", userId)
    .in("id", ids)
    .is("read_at", null);
  if (error) throw error;
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/**
 * Existing destination for a notification, or null when one cannot be safely
 * determined from the data (no new routes are invented).
 */
export interface NotificationTarget {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  hash?: string;
}

export function notificationHref(
  n: NotificationItem,
  role: "player" | "club",
): NotificationTarget | null {
  // Safe fallback: no link when the notification belongs to the other account
  // side (e.g. created before an account switch) or its conversation is gone.
  if (n.forRole === "missing") return null;
  if (n.forRole && n.forRole !== role) return null;
  if (n.entityType === "conversation" && n.entityId) {
    return role === "player"
      ? { to: "/player/messages/$conversationId", params: { conversationId: n.entityId } }
      : { to: "/club/messages/$conversationId", params: { conversationId: n.entityId } };
  }
  if (n.entityType === "trial_invite" && n.entityId) {
    return role === "player"
      ? { to: "/player/trials/$inviteId", params: { inviteId: n.entityId } }
      : { to: "/club/trials", hash: `trial-${n.entityId}` };
  }
  if (n.entityType === "application" && n.entityId) {
    return {
      to: role === "club" ? "/club/applications" : "/player/applications",
      hash: `application-${n.entityId}`,
    };
  }
  if (n.entityType === "vacancy" && n.entityId && n.clubId && role === "player") {
    return {
      to: "/player/clubs/$clubId",
      params: { clubId: n.clubId },
      search: { vacancy: n.entityId },
    };
  }
  if (n.entityType === "media" && n.entityId && role === "player") {
    return { to: "/player/profile", hash: `media-${n.entityId}` };
  }
  if (n.entityType === "player" && n.entityId && role === "club") {
    return { to: "/club/players/$playerId", params: { playerId: n.entityId } };
  }
  return null;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
