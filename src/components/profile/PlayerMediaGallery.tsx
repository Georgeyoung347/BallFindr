/**
 * Grid of a player's media; tap opens MediaLightbox. Data from lib/player-media.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Film, Image as ImageIcon, Pencil, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClipLength, useReorderPlayerMedia, type PlayerMediaItem } from "@/lib/player-media";
import { MediaLightbox } from "@/components/profile/MediaLightbox";
import { REACTIONS, useMediaReactions, useSetMediaReaction, type ReactionKind } from "@/lib/media-reactions";

const LONG_PRESS_MS = 500;

/**
 * Landscape tile grid for a player's photos and clips. Owners get edit and
 * reorder controls; clubs get a view-only gallery. Both open the lightbox.
 */
export function PlayerMediaGallery({
  playerId,
  items,
  isPending,
  error,
  canManage = false,
  onEdit,
}: {
  playerId: string;
  items: PlayerMediaItem[];
  isPending: boolean;
  error?: unknown;
  canManage?: boolean;
  onEdit?: (id: string) => void;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const reorder = useReorderPlayerMedia(playerId);
  const mediaIds = items.map((m) => m.id);
  const { data: reactionData } = useMediaReactions(mediaIds);
  const setReaction = useSetMediaReaction(mediaIds);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerFor) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerFor(null);
    };
    // preventDefault marks the Escape as handled so the Android back button
    // (lib/native-ui) closes the picker instead of navigating back.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPickerFor(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerFor]);

  const idsKey = mediaIds.join(",");
  useEffect(() => {
    const h = window.location.hash.replace(/^#/, "");
    if (!h.startsWith("media-")) return;
    const el = document.getElementById(h);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-xl");
    const t = window.setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-xl"), 2500);
    return () => window.clearTimeout(t);
  }, [idsKey]);

  const userId = reactionData?.userId ?? null;
  const canReactTo = (ownerId: string) => !!userId && userId !== ownerId;

  function cancelPress() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }

  function react(mediaId: string, reaction: ReactionKind) {
    if (!userId || setReaction.isPending) return;
    const current = reactionData?.map[mediaId]?.mine ?? null;
    setPickerFor(null);
    setReaction.mutate(
      { mediaId, reaction, current, userId },
      { onError: () => toast.error("Couldn't save your reaction", { description: "Please try again." }) },
    );
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-[3/2] animate-pulse rounded-xl border border-border bg-elevated/50" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        We couldn't load this media right now. Please refresh and try again.
      </p>
    );
  }

  if (!items.length) return null;

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((m) => m.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved as string);
    reorder.mutate(ids, {
      onError: (e) =>
        toast.error("Couldn't reorder media", { description: e instanceof Error ? e.message : undefined }),
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <figure key={item.id} id={`media-${item.id}`} className="group min-w-0 scroll-mt-24">
            <div className="relative">
            <button
              type="button"
              onPointerDown={(e) => {
                longPressed.current = false;
                if (!canReactTo(item.ownerId)) return;
                pressStart.current = { x: e.clientX, y: e.clientY };
                pressTimer.current = window.setTimeout(() => {
                  longPressed.current = true;
                  pressTimer.current = null;
                  setPickerFor(item.id);
                }, LONG_PRESS_MS);
              }}
              onPointerMove={(e) => {
                const s0 = pressStart.current;
                if (s0 && Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 10) cancelPress();
              }}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => {
                if (canReactTo(item.ownerId)) e.preventDefault();
              }}
              onClick={(e) => {
                if (longPressed.current) {
                  e.preventDefault();
                  longPressed.current = false;
                  return;
                }
                setViewerIndex(index);
              }}
              style={{ WebkitTouchCallout: "none" }}
              aria-label={`Open ${item.kind === "video" ? "clip" : "photo"}${item.title ? `: ${item.title}` : ""}`}
              className="relative block aspect-[3/2] w-full select-none overflow-hidden rounded-xl border border-border bg-elevated/40 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.kind === "video" ? (
                <video
                  src={`${item.url}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none h-full w-full object-cover"
                />
              ) : (
                <img
                  src={item.url}
                  alt={item.title ?? "Player photo"}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              )}
              {item.kind === "video" ? (
                <>
                  <span className="pointer-events-none absolute inset-0 grid place-items-center bg-background/20 transition group-hover:bg-background/10">
                    <span className="grid size-12 place-items-center rounded-full border border-border bg-card/90 text-primary shadow-lg">
                      <Play className="ml-0.5 size-5 fill-current" />
                    </span>
                  </span>
                  <span className="pointer-events-none absolute bottom-2 left-8 inline-flex items-center gap-1 rounded-md border border-border bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    <Film className="size-3" /> Clip{item.durationSeconds ? ` · ${formatClipLength(item.durationSeconds)}` : ""}
                  </span>
                </>
              ) : (
                <span className="pointer-events-none absolute bottom-2 left-8 inline-flex items-center gap-1 rounded-md border border-border bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  <ImageIcon className="size-3" /> Photo
                </span>
              )}
            </button>
            {pickerFor === item.id ? (
              <div
                ref={pickerRef}
                role="toolbar"
                aria-label="React to this media"
                className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur animate-in fade-in-0 zoom-in-95"
              >
                {REACTIONS.map((r) => {
                  const active = reactionData?.map[item.id]?.mine === r.kind;
                  return (
                    <button
                      key={r.kind}
                      type="button"
                      aria-label={r.label}
                      aria-pressed={active}
                      disabled={setReaction.isPending}
                      onClick={() => react(item.id, r.kind)}
                      className={cn(
                        "grid size-9 place-items-center rounded-full text-lg transition hover:scale-110 hover:bg-elevated disabled:opacity-50",
                        active && "bg-primary/20 ring-1 ring-primary",
                      )}
                    >
                      {r.emoji}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {pickerFor !== item.id && canReactTo(item.ownerId) ? (
              <button
                type="button"
                aria-label="Add reaction"
                onClick={() => setPickerFor(item.id)}
                className="absolute bottom-2 left-2 z-10 grid size-[21px] place-items-center rounded-full border border-border bg-card shadow-md transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-3" />
              </button>
            ) : null}
            </div>
            {(() => {
              const summary = reactionData?.map[item.id];
              const shown = REACTIONS.filter((r) => (summary?.counts[r.kind] ?? 0) > 0);
              if (!shown.length) return null;
              return (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {shown.map((r) => (
                    <span
                      key={r.kind}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs tabular-nums",
                        summary?.mine === r.kind && "border-primary text-primary",
                      )}
                      aria-label={`${r.label}: ${summary?.counts[r.kind]}`}
                    >
                      <span aria-hidden>{r.emoji}</span>
                      {summary?.counts[r.kind]}
                    </span>
                  ))}
                </div>
              );
            })()}

            <figcaption className="mt-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("truncate text-sm", item.title ? "font-semibold" : "text-muted-foreground")}>
                  {item.title ?? (item.kind === "video" ? "Untitled clip" : "Untitled photo")}
                </p>
                {item.caption ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.caption}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="quiet"
                    size="icon"
                    className="size-7"
                    aria-label="Move earlier"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    size="icon"
                    className="size-7"
                    aria-label="Move later"
                    disabled={index === items.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    size="icon"
                    className="size-7"
                    aria-label="Edit details"
                    onClick={() => onEdit?.(item.id)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>

      <MediaLightbox
        items={items}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}
