/**
 * Club → player messaging backed by public.conversations / public.messages.
 *
 * Product rule: only a club may start a conversation. The database enforces
 * this (RLS + triggers); the hooks here only expose the club-side "start"
 * action and never offer a player-side equivalent.
 *
 * Security: every read relies on the RLS policies (participants only). All
 * writes are additionally scoped to the signed-in user's id in code.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveProfileImage } from "@/lib/profile-images";

export type ConversationStatus = "active" | "paused" | "blocked";

export const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 50;
const DUPLICATE = "23505";

export interface ConversationCounterpart {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  role: "player" | "club";
  isVerified: boolean;
  isOwner: boolean;
  isFounderClub: boolean;
}

export interface ConversationSummary {
  id: string;
  clubId: string;
  playerId: string;
  status: ConversationStatus;
  pausedBy: string | null;
  pausedAt: string | null;
  blockedBy: string | null;
  blockedAt: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  createdAt: string;
  /** The person on the other side of this conversation from the signed-in user. */
  counterpart: ConversationCounterpart;
  unreadCount: number;
  muted: boolean;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type ConversationRow = {
  id: string;
  club_id: string;
  player_id: string;
  status: ConversationStatus;
  paused_by: string | null;
  paused_at: string | null;
  blocked_by: string | null;
  blocked_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  created_at: string;
};

const conversationSelect =
  "id, club_id, player_id, status, paused_by, paused_at, blocked_by, blocked_at, last_message_at, last_message_preview, last_message_sender_id, created_at";

/** Resolve display details for the other party of each conversation. */
async function resolveCounterparts(
  rows: ConversationRow[],
  me: string,
): Promise<Map<string, ConversationCounterpart>> {
  const out = new Map<string, ConversationCounterpart>();
  if (!rows.length) return out;
  const clubIds = Array.from(new Set(rows.filter((r) => r.club_id !== me).map((r) => r.club_id)));
  const playerIds = Array.from(
    new Set(rows.filter((r) => r.player_id !== me).map((r) => r.player_id)),
  );
  const ids = [...clubIds, ...playerIds];

  const [profileRes, clubRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, verification_status, is_owner").in("id", ids),
    clubIds.length
      ? supabase.from("clubs").select("id, name, short_name, badge_path, is_founder_club").in("id", clubIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (clubRes.error) throw clubRes.error;

  const profiles = new Map((profileRes.data ?? []).map((p) => [p.id, p]));
  const clubs = new Map((clubRes.data ?? []).map((c) => [c.id, c]));

  for (const id of clubIds) {
    const club = clubs.get(id);
    const profile = profiles.get(id);
    const name = club?.name || profile?.display_name || "Club";
    out.set(id, {
      id,
      role: "club",
      name,
      initials: club?.short_name?.trim()
        ? club.short_name.trim().slice(0, 3).toUpperCase()
        : initialsOf(name),
      avatarUrl: await resolveProfileImage(club?.badge_path ?? profile?.avatar_path),
      isVerified: profile?.verification_status === "verified",
      isOwner: Boolean(profile?.is_owner),
      isFounderClub: Boolean(club?.is_founder_club),
    });
  }
  for (const id of playerIds) {
    const profile = profiles.get(id);
    const name = profile?.display_name || "Player";
    out.set(id, {
      id,
      role: "player",
      name,
      initials: initialsOf(name),
      avatarUrl: await resolveProfileImage(profile?.avatar_path),
      isVerified: profile?.verification_status === "verified",
      isOwner: Boolean(profile?.is_owner),
      isFounderClub: false,
    });
  }
  return out;
}

async function fetchUnreadByConversation(me: string): Promise<Map<string, number>> {
  // Only unread rows are fetched (partial index), never message bodies.
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .is("read_at", null)
    .neq("sender_id", me);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const m of data ?? []) counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
  return counts;
}

async function fetchMutedIds(me: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", me)
    .not("muted_at", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.conversation_id));
}

function toSummary(
  r: ConversationRow,
  me: string,
  counterparts: Map<string, ConversationCounterpart>,
  unread: Map<string, number>,
  muted: Set<string>,
): ConversationSummary {
  const otherId = r.club_id === me ? r.player_id : r.club_id;
  return {
    id: r.id,
    clubId: r.club_id,
    playerId: r.player_id,
    status: r.status,
    pausedBy: r.paused_by,
    pausedAt: r.paused_at,
    blockedBy: r.blocked_by,
    blockedAt: r.blocked_at,
    lastMessageAt: r.last_message_at,
    lastMessagePreview: r.last_message_preview,
    lastMessageSenderId: r.last_message_sender_id,
    createdAt: r.created_at,
    counterpart: counterparts.get(otherId) ?? {
      id: otherId,
      role: r.club_id === me ? "player" : "club",
      name: r.club_id === me ? "Player" : "Club",
      initials: "?",
      avatarUrl: null,
      isVerified: false,
      isOwner: false,
      isFounderClub: false,
    },
    unreadCount: unread.get(r.id) ?? 0,
    muted: muted.has(r.id),
  };
}

async function fetchConversations(): Promise<ConversationSummary[]> {
  const me = await currentUserId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("conversations")
    .select(conversationSelect)
    .or(`club_id.eq.${me},player_id.eq.${me}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as ConversationRow[];
  const [counterparts, unread, muted] = await Promise.all([
    resolveCounterparts(rows, me),
    fetchUnreadByConversation(me),
    fetchMutedIds(me),
  ]);
  return rows.map((r) => toSummary(r, me, counterparts, unread, muted));
}

export function useConversations() {
  return useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: fetchConversations,
    staleTime: 10_000,
  });
}

export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ["messages", "unread-total"],
    queryFn: async () => {
      const me = await currentUserId();
      if (!me) return 0;
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .neq("sender_id", me);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 60_000,
  });
}

async function fetchConversation(id: string): Promise<ConversationSummary | null> {
  const me = await currentUserId();
  if (!me) return null;
  const { data, error } = await supabase
    .from("conversations")
    .select(conversationSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ConversationRow;
  const [counterparts, unread, muted] = await Promise.all([
    resolveCounterparts([row], me),
    fetchUnreadByConversation(me),
    fetchMutedIds(me),
  ]);
  return toSummary(row, me, counterparts, unread, muted);
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["messages", "conversation", id],
    queryFn: () => fetchConversation(id),
    staleTime: 10_000,
  });
}

/* ------------------------------------------------------------ messages */

export interface MessagePage {
  messages: MessageItem[]; // chronological
  hasMore: boolean;
}

function toMessage(m: {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}): MessageItem {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    body: m.body,
    readAt: m.read_at,
    createdAt: m.created_at,
  };
}

/** Most recent page first; the component asks for earlier pages on demand. */
export async function fetchMessagesBefore(
  conversationId: string,
  before: string | null,
): Promise<MessagePage> {
  let q = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, read_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  return {
    messages: rows.slice(0, PAGE_SIZE).reverse().map(toMessage),
    hasMore,
  };
}

export function useLatestMessages(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: ["messages", "thread", conversationId],
    queryFn: () => fetchMessagesBefore(conversationId, null),
    enabled,
    staleTime: 5_000,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (raw: string) => {
      const me = await currentUserId();
      if (!me) throw new Error("Sign in to send messages");
      const body = raw.replace(/\s+$/, "").trim();
      if (!body) throw new Error("Message cannot be empty");
      if (body.length > MAX_MESSAGE_LENGTH)
        throw new Error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: me, body })
        .select("id, conversation_id, sender_id, body, read_at, created_at")
        .single();
      if (error) throw new Error(friendlyError(error.message));
      return toMessage(data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const me = await currentUserId();
      if (!me) return;
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", me)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
      void qc.invalidateQueries({ queryKey: ["messages", "unread-total"] });
      void qc.invalidateQueries({ queryKey: ["messages", "conversation", conversationId] });
    },
  });
}

/* ------------------------------------------------------- state actions */

function friendlyError(message: string): string {
  // Postgres raises come through as plain text; strip the driver prefix.
  return message.replace(/^.*?:\s*/, "").trim() || message;
}

export function useConversationActions(conversationId: string) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["messages"] });

  const setStatus = async (status: ConversationStatus) => {
    const me = await currentUserId();
    if (!me) throw new Error("Sign in first");
    const { data, error } = await supabase
      .from("conversations")
      .update({ status })
      .eq("id", conversationId)
      .or(`club_id.eq.${me},player_id.eq.${me}`)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(friendlyError(error.message));
    if (!data) throw new Error("Conversation not found");
  };

  const setMuted = async (muted: boolean) => {
    const me = await currentUserId();
    if (!me) throw new Error("Sign in first");
    const { error } = await supabase
      .from("conversation_participants")
      .update({ muted_at: muted ? new Date().toISOString() : null })
      .eq("conversation_id", conversationId)
      .eq("profile_id", me);
    if (error) throw new Error(friendlyError(error.message));
  };

  const pause = useMutation({ mutationFn: () => setStatus("paused"), onSettled: invalidate });
  const resume = useMutation({ mutationFn: () => setStatus("active"), onSettled: invalidate });
  const block = useMutation({ mutationFn: () => setStatus("blocked"), onSettled: invalidate });
  // Unblock uses the same status move; the database only allows it for the blocker
  // and lifts that person's block row, keeping the conversation and its history.
  const unblock = useMutation({ mutationFn: () => setStatus("active"), onSettled: invalidate });
  const mute = useMutation({ mutationFn: () => setMuted(true), onSettled: invalidate });
  const unmute = useMutation({ mutationFn: () => setMuted(false), onSettled: invalidate });

  return { pause, resume, block, unblock, mute, unmute };
}

/* -------------------------------------------------------- club: start */

/**
 * Club-only: open the existing conversation with a player, or create one.
 * Players have no equivalent — the database rejects any non-club insert.
 */
export async function startOrOpenConversation(playerId: string): Promise<string> {
  const me = await currentUserId();
  if (!me) throw new Error("Sign in first");

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("club_id", me)
    .eq("player_id", playerId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ club_id: me, player_id: playerId })
    .select("id")
    .single();
  if (error) {
    if (error.code === DUPLICATE) {
      const { data: again } = await supabase
        .from("conversations")
        .select("id")
        .eq("club_id", me)
        .eq("player_id", playerId)
        .maybeSingle();
      if (again) return again.id;
    }
    if (/row-level security|cannot message/i.test(error.message)) {
      throw new Error("You can't message this player.");
    }
    throw new Error(friendlyError(error.message));
  }
  return data.id;
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startOrOpenConversation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["messages", "conversations"] }),
  });
}

/* ------------------------------------------------------------ realtime */

/**
 * One realtime channel per signed-in session. RLS restricts which rows are
 * delivered, so the app only ever hears about its own conversations. On any
 * change the relevant queries are invalidated; if the socket drops, the
 * queries still refetch on focus / interval, so the UI stays usable.
 */
export function useMessagingRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("messaging")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const convId = (payload.new as { conversation_id?: string }).conversation_id;
          void qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
          void qc.invalidateQueries({ queryKey: ["messages", "unread-total"] });
          if (convId) void qc.invalidateQueries({ queryKey: ["messages", "thread", convId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          void qc.invalidateQueries({ queryKey: ["messages", "unread-total"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          const id = ((payload.new ?? payload.old) as { id?: string }).id;
          void qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
          if (id) void qc.invalidateQueries({ queryKey: ["messages", "conversation", id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}

/* --------------------------------------------------------- formatting */

export function messageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
