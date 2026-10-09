/**
 * Admin > Conversations: read-only view of conversations and messages (full admin only).
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminEmpty, AdminShell, adminBeforeLoad, adminField, adminHead, formatDate } from "@/lib/admin-ui";
import {
  getAdminConversation,
  listAdminConversations,
  type AdminConvParty,
  type AdminConvState,
} from "@/lib/admin-conversations.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/conversations")({
  staticData: { sitemap: false },
  ssr: false,
  beforeLoad: adminBeforeLoad,
  head: () => adminHead("Conversations"),
  component: AdminConversationsPage,
});

const stateLabels: Record<Exclude<AdminConvState, "ok">, string> = {
  hidden: "Hidden",
  banned: "Restricted",
  switched: "Switched type",
  deleted: "Deleted",
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function PartyName({ party }: { party: AdminConvParty }) {
  const tags = party.states.filter((s): s is Exclude<AdminConvState, "ok"> => s !== "ok" && s !== "deleted");
  if (!party.id) return <span className="text-muted-foreground">{party.name}</span>;
  return (
    <span>
      <Link to="/admin/users/$profileId" params={{ profileId: party.id }} className="hover:underline">
        {party.name}
      </Link>
      {tags.map((t) => (
        <span key={t} className="ml-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {stateLabels[t]}
        </span>
      ))}
    </span>
  );
}

function ConversationDetail({ id }: { id: string }) {
  const get = useServerFn(getAdminConversation);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "conversation", id],
    queryFn: () => get({ data: { id } }),
  });
  if (isLoading) return <p className="mt-3 text-sm text-muted-foreground">Loading messages…</p>;
  if (error || !data) return <p className="mt-3 text-sm text-destructive">Could not load this conversation.</p>;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Started {fmtTime(data.createdAt)}</p>
        <p>Last message {fmtTime(data.lastMessageAt)}</p>
        <p>Status: {data.status}</p>
        {data.pausedAt ? <p>Paused {fmtTime(data.pausedAt)}{data.pausedByName ? ` by ${data.pausedByName}` : ""}</p> : null}
        {data.blockedAt ? <p>Blocked {fmtTime(data.blockedAt)}{data.blockedByName ? ` by ${data.blockedByName}` : ""}</p> : null}
      </div>
      <ol className="mt-3 space-y-2">
        {data.messages.length ? (
          data.messages.map((m) => {
            const fromClub = m.senderId === data.club.id;
            return (
              <li key={m.id} className={cn("rounded-lg border border-border p-3", fromClub ? "bg-elevated" : "bg-card")}>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{m.senderName}</span>
                  <span>
                    {fmtTime(m.createdAt)}
                    {m.readAt ? ` • read ${fmtTime(m.readAt)}` : " • unread"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>
              </li>
            );
          })
        ) : (
          <li className="text-sm text-muted-foreground">No messages in this conversation.</li>
        )}
      </ol>
    </div>
  );
}

function AdminConversationsPage() {
  const list = useServerFn(listAdminConversations);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "conversations"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [state, setState] = useState<AdminConvState | "">("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(
      (c) =>
        (!q || `${c.player.name} ${c.club.name}`.toLowerCase().includes(q)) &&
        (!state || c.player.states.includes(state) || c.club.states.includes(state)),
    );
  }, [data, search, state]);

  return (
    <AdminShell title="Conversations" description="Read-only view of conversations for moderation, safety and support.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={adminField} placeholder="Search player or club" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={cn(adminField, "sm:max-w-48")} value={state} onChange={(e) => setState(e.target.value as AdminConvState | "")}>
          <option value="">All accounts</option>
          {(Object.keys(stateLabels) as Exclude<AdminConvState, "ok">[]).map((s) => (
            <option key={s} value={s}>{stateLabels[s]}</option>
          ))}
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading ? (
          <AdminEmpty>Loading conversations…</AdminEmpty>
        ) : error ? (
          <AdminEmpty>Could not load conversations.</AdminEmpty>
        ) : rows.length ? (
          rows.map((c) => {
            const expanded = open === c.id;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <PartyName party={c.player} /> <span className="text-muted-foreground">↔</span> <PartyName party={c.club} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[`Started ${formatDate(c.createdAt)}`, c.lastMessageAt ? `Last message ${formatDate(c.lastMessageAt)}` : "No messages", `${c.messageCount} message${c.messageCount === 1 ? "" : "s"}`].join(" • ")}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-elevated px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">{c.status}</span>
                </div>
                <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => setOpen(expanded ? null : c.id)}>
                  {expanded ? "Hide messages" : "View messages"}
                </button>
                {expanded ? <ConversationDetail id={c.id} /> : null}
              </div>
            );
          })
        ) : (
          <AdminEmpty>{data.length ? "No conversations match." : "No conversations yet."}</AdminEmpty>
        )}
      </div>
    </AdminShell>
  );
}
