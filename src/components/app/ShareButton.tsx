/**
 * The single shared Share button. Uses the Web Share API when available, otherwise copies the permanent public URL (/players|/clubs|/vacancies/{slug}). Renders nothing without a slug.
 */
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareUrl, type ShareKind } from "@/lib/share";

/** Native share sheet where supported; otherwise copies the canonical link. */
export function ShareButton({
  kind,
  slug,
  title,
  text,
  size = "sm",
  variant = "subtle",
}: {
  kind: ShareKind;
  slug: string | null | undefined;
  title: string;
  text?: string;
  size?: "sm" | "default";
  variant?: "subtle" | "voltOutline" | "volt";
}) {
  if (!slug) return null;
  const url = shareUrl(kind, slug);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link. You can copy it from the address bar.");
    }
  };

  const onShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: text ?? title, url });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={() => void onShare()}>
      <Share2 className="size-4" /> Share
    </Button>
  );
}
