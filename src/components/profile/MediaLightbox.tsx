/**
 * Fullscreen media viewer for player clips/photos; long-press shows 🔥 👍 👀 reactions (lib/media-reactions).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatClipLength, type PlayerMediaItem } from "@/lib/player-media";

/**
 * Full-screen viewer for player photos and clips. Keeps the original aspect
 * ratio (object-contain), supports keyboard arrows and touch swipe, and
 * never leaves the app.
 */
export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: PlayerMediaItem[];
  /** null = closed */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const open = index !== null && index >= 0 && index < items.length;
  const item = open ? items[index] : undefined;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [imageError, setImageError] = useState(false);

  const go = useCallback(
    (delta: number) => {
      if (index === null || items.length < 2) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    setImageError(false);
  }, [item?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const hasMany = items.length > 1;
  const label = item?.title ?? (item?.kind === "video" ? "Video clip" : "Photo");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] outline-none"
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            const t = e.changedTouches[0];
            touchStart.current = null;
            if (!start || !t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {item?.caption ?? "Full-screen media viewer"}
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{label}</p>
              {hasMany && index !== null ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {index + 1} of {items.length}
                </p>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close viewer"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-16">
            {item ? (
              item.kind === "video" ? (
                <video
                  key={item.id}
                  src={item.url}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  className="max-h-full max-w-full rounded-lg bg-black object-contain"
                />
              ) : imageError ? (
                <p className="text-sm text-muted-foreground">This photo couldn't be loaded.</p>
              ) : (
                <img
                  key={item.id}
                  src={item.url}
                  alt={label}
                  onError={() => setImageError(true)}
                  className="max-h-full max-w-full select-none rounded-lg object-contain"
                  draggable={false}
                />
              )
            ) : null}

            {hasMany ? (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground transition hover:bg-elevated sm:grid"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground transition hover:bg-elevated sm:grid"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {item?.caption ? (
                <span className="line-clamp-3">{item.caption}</span>
              ) : item?.kind === "video" && item.durationSeconds ? (
                <span>Clip · {formatClipLength(item.durationSeconds)}</span>
              ) : null}
            </p>
            {hasMany ? (
              <div className="flex gap-2 sm:hidden">
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => go(-1)}
                  className="grid size-10 place-items-center rounded-full border border-border bg-card"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => go(1)}
                  className="grid size-10 place-items-center rounded-full border border-border bg-card"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
