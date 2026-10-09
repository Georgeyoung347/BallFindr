/**
 * Player > a single conversation (ConversationView).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ConversationView } from "@/components/app/messaging/ConversationView";

const title = "Conversation — BallFindr";
const description = "Your conversation with a club on BallFindr.";

export const Route = createFileRoute("/player/messages/$conversationId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayerConversationPage,
});

function PlayerConversationPage() {
  const { conversationId } = Route.useParams();
  // key: remount per conversation so earlier pages, draft and dialogs never carry over.
  return <ConversationView key={conversationId} conversationId={conversationId} role="player" />;
}
