/**
 * List of the user's conversations (Player and Club Messages pages). Data from lib/messaging.
 */
import { Link } from "@tanstack/react-router";
import { BellOff, Ban, PauseCircle } from "lucide-react";
import { Avatar, Panel } from "@/components/app/ui";
import { relativeTime } from "@/lib/notifications";
import type { ConversationSummary } from "@/lib/messaging";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";

export function CounterpartAvatar({
  name,
  initials,
  avatarUrl,
  className,
}: {
  name: string;
  initials: string;
  avatarUrl: string | null;
  className?: string;
}) {
  return <Avatar initials={initials} imageUrl={avatarUrl} alt={name} {...(className ? { className } : {})} />;
}

export function ConversationList({
  conversations,
  role,
  meId,
}: {
  conversations: ConversationSummary[];
  role: "player" | "club";
  meId: string | null;
}) {
  const to = role === "club" ? "/club/messages/$conversationId" : "/player/messages/$conversationId";
  return (
    <ul className="space-y-2">
      {conversations.map((c) => {
        const unread = c.unreadCount > 0;
        const preview = c.lastMessagePreview
          ? `${c.lastMessageSenderId === meId ? "You: " : ""}${c.lastMessagePreview}`
          : role === "club"
            ? "Send the first message"
            : "No messages yet";
        return (
          <li key={c.id}>
            <Link to={to} params={{ conversationId: c.id }} className="block">
              <Panel
                as="article"
                className={cn(
                  "flex items-center gap-3 p-3 transition-colors hover:border-primary/40 sm:p-4",
                  unread && "border-primary/30 bg-primary/5",
                  c.status === "blocked" && "opacity-70",
                )}
              >
                <CounterpartAvatar
                  name={c.counterpart.name}
                  initials={c.counterpart.initials}
                  avatarUrl={c.counterpart.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate font-display text-sm uppercase",
                        unread ? "text-foreground" : "text-foreground/90",
                      )}
                    >
                      <AccountName verified={c.counterpart.isVerified} owner={c.counterpart.isOwner} founder={c.counterpart.isFounderClub}>{c.counterpart.name}</AccountName>
                    </p>
                    <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                      {relativeTime(c.lastMessageAt ?? c.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        unread ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {preview}
                    </p>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      {c.muted ? <BellOff className="size-3.5" aria-label="Muted" /> : null}
                      {c.status === "paused" ? (
                        <PauseCircle className="size-3.5" aria-label="Paused" />
                      ) : null}
                      {c.status === "blocked" ? (
                        <Ban className="size-3.5 text-destructive" aria-label="Blocked" />
                      ) : null}
                      {unread ? (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {c.unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              </Panel>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
