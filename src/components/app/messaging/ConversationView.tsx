/**
 * One conversation thread: loads messages, live updates, sends new messages. RLS ensures only participants can read/write; restricted accounts cannot send.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Send,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Panel, Pill } from "@/components/app/ui";
import { CounterpartAvatar } from "./ConversationList";
import {
  MAX_MESSAGE_LENGTH,
  dayLabel,
  fetchMessagesBefore,
  messageTime,
  useConversation,
  useConversationActions,
  useLatestMessages,
  useMarkConversationRead,
  useSendMessage,
  type MessageItem,
} from "@/lib/messaging";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AccountName } from "@/components/app/AccountName";
import { ReportMessageButton } from "@/components/app/ReportDialog";

function useMeId() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setMe(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

export function ConversationView({
  conversationId,
  role,
}: {
  conversationId: string;
  role: "player" | "club";
}) {
  const me = useMeId();
  const { data: conversation, isLoading, isError, refetch } = useConversation(conversationId);
  const latest = useLatestMessages(conversationId, Boolean(conversation));
  const send = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const actions = useConversationActions(conversationId);

  const [earlier, setEarlier] = useState<MessageItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState<"pause" | "block" | "unblock" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (latest.data) setHasMore(latest.data.hasMore);
  }, [latest.data]);

  const messages = useMemo(() => {
    const recent = latest.data?.messages ?? [];
    const seen = new Set(recent.map((m) => m.id));
    return [...earlier.filter((m) => !seen.has(m.id)), ...recent];
  }, [earlier, latest.data]);

  // Mark incoming messages read whenever new unread ones are on screen.
  const unreadIncoming = messages.some((m) => m.senderId !== me && !m.readAt);
  useEffect(() => {
    if (!me || !unreadIncoming || markRead.isPending) return;
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, unreadIncoming, messages.length]);

  // Keep the newest message in view.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  const loadEarlier = async () => {
    const oldest = messages[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const page = await fetchMessagesBefore(conversationId, oldest.createdAt);
      setEarlier((prev) => [...page.messages, ...prev]);
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevHeight;
      });
    } catch (e) {
      toast.error("Couldn't load earlier messages", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoadingEarlier(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body, {
      onSuccess: () => setDraft(""),
      onError: (err) =>
        toast.error("Message not sent", {
          description: err instanceof Error ? err.message : "Please try again.",
        }),
    });
  };

  const backTo = role === "club" ? "/club/messages" : "/player/messages";

  if (isLoading || !me) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">Loading conversation…</p>
      </Panel>
    );
  }
  if (isError) {
    return (
      <Panel className="text-center">
        <p className="font-display text-lg uppercase">Couldn't load this conversation</p>
        <Button variant="subtle" size="sm" className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </Panel>
    );
  }
  if (!conversation) {
    return (
      <Panel className="py-12 text-center">
        <p className="font-display text-lg uppercase">Conversation not found</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          This conversation doesn't exist or you don't have access to it.
        </p>
        <Button asChild variant="subtle" size="sm" className="mt-4">
          <Link to={backTo}>Back to messages</Link>
        </Button>
      </Panel>
    );
  }

  const other = conversation.counterpart;
  const profileLink =
    other.role === "player"
      ? { to: "/club/players/$playerId" as const, params: { playerId: other.id } }
      : { to: "/player/clubs/$clubId" as const, params: { clubId: other.id } };
  const iPaused = conversation.status === "paused" && conversation.pausedBy === me;
  const iBlocked = conversation.status === "blocked" && conversation.blockedBy === me;
  const canSend = conversation.status === "active";
  const remaining = MAX_MESSAGE_LENGTH - draft.length;

  const runAction = (
    m: { mutate: (v: void, o?: { onSuccess?: () => void; onError?: (e: Error) => void }) => void },
    ok: string,
  ) =>
    m.mutate(undefined, {
      onSuccess: () => toast.success(ok),
      onError: (e) => toast.error("Couldn't update conversation", { description: e.message }),
    });

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[28rem] flex-col lg:h-[calc(100dvh-7.5rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button asChild variant="quiet" size="icon" className="-ml-2 shrink-0" aria-label="Back">
          <Link to={backTo}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Link {...profileLink} className="flex min-w-0 flex-1 items-center gap-3">
          <CounterpartAvatar
            name={other.name}
            initials={other.initials}
            avatarUrl={other.avatarUrl}
            className="size-10"
          />
          <div className="min-w-0">
            <p className="font-display text-base uppercase"><AccountName verified={other.isVerified} owner={other.isOwner} founder={other.isFounderClub}>{other.name}</AccountName></p>
            <p className="truncate text-xs text-muted-foreground">
              {other.role === "club" ? "Club · View profile" : "Player · View profile"}
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {conversation.muted ? <Pill className="hidden sm:inline-flex">Muted</Pill> : null}
          {conversation.status === "paused" ? (
            <Pill tone="primary" className="hidden sm:inline-flex">
              Paused
            </Pill>
          ) : null}
          {conversation.status === "blocked" ? (
            <Pill className="hidden border-destructive/40 text-destructive sm:inline-flex">
              Blocked
            </Pill>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle" size="icon" aria-label="Conversation options">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {conversation.muted ? (
                <DropdownMenuItem onSelect={() => runAction(actions.unmute, "Notifications back on")}>
                  <Bell className="size-4" /> Unmute conversation
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => runAction(actions.mute, "Conversation muted")}>
                  <BellOff className="size-4" /> Mute conversation
                </DropdownMenuItem>
              )}
              {conversation.status === "active" ? (
                <DropdownMenuItem onSelect={() => setConfirm("pause")}>
                  <PauseCircle className="size-4" /> Pause chat
                </DropdownMenuItem>
              ) : null}
              {iPaused ? (
                <DropdownMenuItem onSelect={() => runAction(actions.resume, "Chat resumed")}>
                  <PlayCircle className="size-4" /> Resume chat
                </DropdownMenuItem>
              ) : null}
              {conversation.status !== "blocked" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirm("block")}
                  >
                    <Ban className="size-4" /> Block {other.role === "club" ? "club" : "player"}
                  </DropdownMenuItem>
                </>
              ) : iBlocked ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirm("unblock")}>
                    <ShieldOff className="size-4" /> Unblock{" "}
                    {other.role === "club" ? "club" : "player"}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto py-4">
        {latest.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading messages…</p>
        ) : latest.isError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load messages.</p>
            <Button variant="subtle" size="sm" className="mt-3" onClick={() => void latest.refetch()}>
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-display text-base uppercase">No messages yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              {role === "club"
                ? `Introduce your club to ${other.name} and let them know why you're getting in touch.`
                : `${other.name} hasn't sent anything yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {hasMore ? (
              <div className="pb-3 text-center">
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={loadingEarlier}
                  onClick={() => void loadEarlier()}
                >
                  {loadingEarlier ? "Loading…" : "Load earlier messages"}
                </Button>
              </div>
            ) : null}
            {messages.map((m, i) => {
              const mine = m.senderId === me;
              const prev = messages[i - 1];
              const newDay =
                !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              return (
                <div key={m.id}>
                  {newDay ? (
                    <p className="my-4 text-center text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      {dayLabel(m.createdAt)}
                    </p>
                  ) : null}
                  <div className={cn("flex items-end gap-1", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap sm:max-w-[70%]",
                        mine
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-elevated text-foreground",
                      )}
                    >
                      <p>{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px] tracking-wide uppercase",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {messageTime(m.createdAt)}
                      </p>
                    </div>
                    {mine ? null : (
                      <ReportMessageButton
                        messageId={m.id}
                        senderId={m.senderId}
                        senderName={other.name}
                        body={m.body}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer / state banners */}
      <div className="border-t border-border pt-3">
        {conversation.status === "blocked" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm uppercase">Conversation blocked</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {iBlocked
                    ? `You blocked ${other.name}. No further messages can be sent, and this ${other.role} can't start a new conversation with you. You can unblock at any time — your message history stays.`
                    : "This conversation has been blocked. No further messages can be sent."}
                </p>
              </div>
              {iBlocked ? (
                <Button
                  variant="subtle"
                  size="sm"
                  disabled={actions.unblock.isPending}
                  onClick={() => setConfirm("unblock")}
                >
                  <ShieldOff className="size-4" /> Unblock
                </Button>
              ) : null}
            </div>
          </div>
        ) : conversation.status === "paused" ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm uppercase">Chat paused</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {iPaused
                    ? "You paused this conversation."
                    : "This conversation has been paused by the other participant."}
                  {conversation.pausedAt
                    ? ` Paused ${new Date(conversation.pausedAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}.`
                    : ""}
                </p>
              </div>
              {iPaused ? (
                <Button
                  variant="volt"
                  size="sm"
                  disabled={actions.resume.isPending}
                  onClick={() => runAction(actions.resume, "Chat resumed")}
                >
                  <PlayCircle className="size-4" /> Resume chat
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              placeholder={`Message ${other.name}`}
              aria-label="Message"
              rows={1}
              disabled={!canSend || send.isPending}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border-border bg-elevated/60 py-3"
            />
            <Button
              type="submit"
              variant="volt"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              aria-label="Send"
              disabled={!canSend || send.isPending || !draft.trim()}
            >
              <Send className="size-4" />
            </Button>
          </form>
        )}
        {canSend && remaining < 200 ? (
          <p className="mt-1 text-right text-[10px] text-muted-foreground">{remaining} left</p>
        ) : null}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "block"
                ? `Block ${other.name}?`
                : confirm === "unblock"
                  ? `Unblock ${other.name}?`
                  : "Pause this chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "block"
                ? `Neither of you will be able to send messages, and ${other.name} won't be able to start a new conversation with you. Your message history stays visible. You can unblock later.`
                : confirm === "unblock"
                  ? `This conversation opens back up and you can both send messages again. Your full message history stays exactly as it is, and ${other.name} isn't told about this.`
                  : "Nobody can send messages while the chat is paused. Only you will be able to resume it. Your message history stays intact."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(confirm === "block" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              onClick={() => {
                if (confirm === "block") runAction(actions.block, `${other.name} blocked`);
                else if (confirm === "unblock") runAction(actions.unblock, `${other.name} unblocked`);
                else runAction(actions.pause, "Chat paused");
                setConfirm(null);
              }}
            >
              {confirm === "block" ? "Block" : confirm === "unblock" ? "Unblock" : "Pause chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
