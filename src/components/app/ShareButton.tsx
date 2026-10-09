/**
 * The single shared Share button. In the native app it opens the OS share sheet via @capacitor/share; on the web it uses the Web Share API when available, otherwise copies the permanent public URL (/players|/clubs|/vacancies/{slug}). Renders nothing without a slug.
 */
import { Capacitor } from "@capacitor/core";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareUrl, type ShareKind } from "@/lib/share";

/** True only inside the Capacitor app shell with the Share plugin; false in browsers and SSR. */
function canShareNatively(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share");
  } catch {
    return false;
  }
}

/**
 * Native app only: the OS share sheet via @capacitor/share (loaded on demand,
 * like lib/native-ui). "done" covers shared and user-cancelled (no toast);
 * "unavailable" means the plugin failed, so fall back to the web paths.
 */
async function shareNatively(options: {
  title: string;
  text: string;
  url: string;
}): Promise<"done" | "unavailable"> {
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ ...options, dialogTitle: "Share" });
    return "done";
  } catch (err) {
    const message = String((err as { message?: unknown })?.message ?? err).toLowerCase();
    // iOS and Android both reject with "Share canceled"; a second tap while the
    // sheet is open rejects with "...sharing is in progress". Neither is an error.
    if (message.includes("cancel") || message.includes("in progress")) return "done";
    return "unavailable";
  }
}

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
      // Show the link itself: there's no address bar to copy from in the app.
      toast.error("Couldn't copy the link", { description: url });
    }
  };

  const onShare = async () => {
    // Checked synchronously first so browsers keep the click's user activation
    // for navigator.share (no await before it on the web).
    if (
      canShareNatively() &&
      (await shareNatively({ title, text: text ?? title, url })) === "done"
    ) {
      return;
    }
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
