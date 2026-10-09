/**
 * Club-side button that opens (or creates) a conversation with a player then navigates to it.
 */
import { useNavigate } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useStartConversation } from "@/lib/messaging";

/**
 * Club-only action: opens the existing conversation with a player or starts a
 * new one. There is intentionally no player-side counterpart.
 */
export function MessagePlayerButton({
  playerId,
  variant = "subtle",
  size,
  label = "Message player",
}: {
  playerId: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  label?: string;
}) {
  const navigate = useNavigate();
  const start = useStartConversation();
  return (
    <Button
      variant={variant}
      size={size}
      disabled={start.isPending}
      onClick={() =>
        start.mutate(playerId, {
          onSuccess: (conversationId) =>
            void navigate({ to: "/club/messages/$conversationId", params: { conversationId } }),
          onError: (e) =>
            toast.error("Couldn't open conversation", {
              description: e instanceof Error ? e.message : undefined,
            }),
        })
      }
    >
      <MessageSquare className="size-4" />
      {start.isPending ? "Opening…" : label}
    </Button>
  );
}
