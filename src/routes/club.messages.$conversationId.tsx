/**
 * Club > a single conversation (ConversationView).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ConversationView } from "@/components/app/messaging/ConversationView";

const title = "Conversation — BallFindr";
const description = "Your conversation with a player on BallFindr.";

export const Route = createFileRoute("/club/messages/$conversationId")({
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
  component: () => {
    const { conversationId } = Route.useParams();
    return <ConversationView conversationId={conversationId} role="club" />;
  },
});
