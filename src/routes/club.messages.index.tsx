/**
 * Club > Messages: list of conversations.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/ui";
import { ConversationList } from "@/components/app/messaging/ConversationList";
import { useConversations } from "@/lib/messaging";
import { supabase } from "@/integrations/supabase/client";

const title = "Messages — BallFindr";
const description = "Message players directly about trials, training and joining your club.";

export const Route = createFileRoute("/club/messages/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClubMessages,
});

function ClubMessages() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader title="Messages" subtitle="Conversations with players you're recruiting." />
      {isLoading ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Loading conversations…</p>
        </Panel>
      ) : isError ? (
        <Panel className="text-center">
          <p className="text-sm text-muted-foreground">Couldn't load your conversations.</p>
          <Button variant="subtle" size="sm" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </Panel>
      ) : conversations && conversations.length ? (
        <ConversationList conversations={conversations} role="club" meId={me} />
      ) : (
        <Panel className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div>
            <p className="font-display text-lg uppercase">No conversations yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Find a player and start a conversation when you're ready.
            </p>
          </div>
          <Button asChild variant="volt">
            <Link to="/club/find-players">
              <Search className="size-4" /> Find players
            </Link>
          </Button>
        </Panel>
      )}
    </div>
  );
}
