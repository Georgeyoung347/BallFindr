/**
 * Admin Conversations (read-only, full administrators only).
 *
 * Security model (same as Admin Trial Invites / Successful Connections):
 * requireSupabaseAuth verifies the bearer token, requireAdminContext re-checks
 * public.is_admin() in the database (moderators are refused), and only then is
 * the service-role client loaded inside the handler. Member RLS on
 * conversations/messages is untouched and nothing is written.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminContext } from "./admin.functions";

export type AdminConvState = "ok" | "hidden" | "banned" | "switched" | "deleted";

export type AdminConvParty = {
  id: string | null;
  name: string;
  states: AdminConvState[];
};

export type AdminConversation = {
  id: string;
  status: string;
  createdAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  player: AdminConvParty;
  club: AdminConvParty;
};

export type AdminConversationMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type AdminConversationDetail = AdminConversation & {
  pausedAt: string | null;
  blockedAt: string | null;
  blockedByName: string | null;
  pausedByName: string | null;
  messages: AdminConversationMessage[];
};

async function loadParties(db: any, profileIds: string[]) {
  if (!profileIds.length) return () => ({ id: null, name: "", states: [] as AdminConvState[] });
  const [profilesRes, clubsRes, restrRes] = await Promise.all([
    db.from("profiles").select("id, display_name, is_hidden, account_type").in("id", profileIds),
    db.from("clubs").select("id, name").in("id", profileIds),
    db.from("account_restrictions").select("profile_id, expires_at").in("profile_id", profileIds).is("lifted_at", null),
  ]);
  const now = Date.now();
  const banned = new Set(
    ((restrRes.data ?? []) as any[])
      .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
      .map((r) => r.profile_id),
  );
  const profiles = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.id, p]));
  const clubs = new Map(((clubsRes.data ?? []) as any[]).map((c) => [c.id, c]));
  return (id: string | null, kind: "Player" | "Club"): AdminConvParty => {
    const p = id ? profiles.get(id) : null;
    if (!id || !p) return { id: null, name: `Deleted ${kind}`, states: ["deleted"] };
    const name = (kind === "Club" ? clubs.get(id)?.name : null) || p.display_name || kind;
    const states: AdminConvState[] = [];
    if (p.is_hidden) states.push("hidden");
    if (banned.has(id)) states.push("banned");
    if (p.account_type !== (kind === "Club" ? "club" : "player")) states.push("switched");
    return { id, name, states: states.length ? states : ["ok"] };
  };
}

export const listAdminConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminConversation[]> => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data, error } = await db
      .from("conversations")
      .select("id, status, created_at, last_message_at, player_id, club_id")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (error) throw new Error("Could not load conversations");
    const rows = (data ?? []) as any[];
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const { data: msgs } = await db.from("messages").select("conversation_id").in("conversation_id", ids).limit(100000);
    const counts = new Map<string, number>();
    for (const m of (msgs ?? []) as any[]) counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);

    const party = await loadParties(db, [...new Set(rows.flatMap((r) => [r.player_id, r.club_id]))]);
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      lastMessageAt: r.last_message_at,
      messageCount: counts.get(r.id) ?? 0,
      player: party(r.player_id, "Player"),
      club: party(r.club_id, "Club"),
    }));
  });

export const getAdminConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input || typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid conversation");
    return { id: input.id };
  })
  .handler(async ({ context, data }): Promise<AdminConversationDetail> => {
    await requireAdminContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: c, error } = await db
      .from("conversations")
      .select("id, status, created_at, last_message_at, player_id, club_id, paused_at, paused_by, blocked_at, blocked_by")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !c) throw new Error("Conversation not found");

    const { data: msgs, error: mErr } = await db
      .from("messages")
      .select("id, sender_id, body, created_at, read_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (mErr) throw new Error("Could not load messages");
    const messages = (msgs ?? []) as any[];

    const ids = [...new Set([c.player_id, c.club_id, c.paused_by, c.blocked_by, ...messages.map((m) => m.sender_id)].filter(Boolean))] as string[];
    const party = await loadParties(db, ids);
    const player = party(c.player_id, "Player");
    const club = party(c.club_id, "Club");
    const nameOf = (id: string | null) => {
      if (!id) return null;
      if (id === c.player_id) return player.name;
      if (id === c.club_id) return club.name;
      const p = party(id, "Player");
      return p.states.includes("deleted") ? "Deleted account" : p.name;
    };

    return {
      id: c.id,
      status: c.status,
      createdAt: c.created_at,
      lastMessageAt: c.last_message_at,
      messageCount: messages.length,
      player,
      club,
      pausedAt: c.paused_at,
      blockedAt: c.blocked_at,
      pausedByName: nameOf(c.paused_by),
      blockedByName: nameOf(c.blocked_by),
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: nameOf(m.sender_id) ?? "Deleted account",
        body: m.body,
        createdAt: m.created_at,
        readAt: m.read_at,
      })),
    };
  });
