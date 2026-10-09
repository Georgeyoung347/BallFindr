/** Edit title/caption or delete one of the signed-in player's media items. */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_MEDIA_CAPTION,
  MAX_MEDIA_TITLE,
  useDeletePlayerMedia,
  useUpdatePlayerMediaDetails,
  type PlayerMediaItem,
} from "@/lib/player-media";

export function PlayerMediaEditDialog({
  item,
  open,
  onOpenChange,
}: {
  item: PlayerMediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useUpdatePlayerMediaDetails();
  const remove = useDeletePlayerMedia();

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      return;
    }
    setTitle(item?.title ?? "");
    setCaption(item?.caption ?? "");
  }, [open, item?.id, item?.title, item?.caption]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!item) return;
    try {
      await save.mutateAsync({ id: item.id, title, caption });
      toast.success("Media details updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this media item.");
    }
  }

  async function onDelete() {
    if (!item) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(item.id);
      toast.success(item.kind === "video" ? "Clip removed" : "Photo removed");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove this media item.");
    }
  }

  const busy = save.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">
            Edit {item?.kind === "video" ? "clip" : "photo"}
          </DialogTitle>
          <DialogDescription>Update the title and caption, or remove this item.</DialogDescription>
        </DialogHeader>

        {!item ? (
          <p className="py-6 text-sm text-muted-foreground">This media item could not be found.</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="aspect-[3/2] w-full overflow-hidden rounded-xl border border-border bg-elevated/40">
              {item.kind === "video" ? (
                <video src={item.url} muted playsInline controls preload="metadata" className="h-full w-full object-contain" />
              ) : (
                <img src={item.url} alt={item.title ?? "Player photo"} className="h-full w-full object-contain" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Title (optional)
              </Label>
              <Input value={title} maxLength={MAX_MEDIA_TITLE} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Caption (optional)
              </Label>
              <Textarea
                rows={3}
                value={caption}
                maxLength={MAX_MEDIA_CAPTION}
                onChange={(e) => setCaption(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {caption.length}/{MAX_MEDIA_CAPTION}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "subtle"}
                onClick={onDelete}
                disabled={busy}
              >
                {remove.isPending ? "Removing…" : confirmDelete ? "Confirm remove" : "Remove"}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="volt" disabled={busy}>
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
