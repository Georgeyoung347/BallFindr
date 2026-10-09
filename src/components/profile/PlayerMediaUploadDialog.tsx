/**
 * Add-media dialog for the signed-in player: pick Photo or Video, choose a
 * file (validated client-side, re-checked by the database), optional title
 * and caption, with upload progress.
 */

import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon, LoaderCircle, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  MAX_MEDIA_CAPTION,
  MAX_MEDIA_TITLE,
  MAX_VIDEO_SECONDS,
  PHOTO_ACCEPT,
  VIDEO_ACCEPT,
  useUploadPlayerMedia,
  validatePlayerMedia,
  type PlayerMediaKind,
  type UploadStage,
} from "@/lib/player-media";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PlayerMediaUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<PlayerMediaKind>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<UploadStage>("uploading");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const upload = useUploadPlayerMedia();

  useEffect(() => {
    if (open) return;
    setKind("photo");
    setFile(null);
    setFileError(null);
    setTitle("");
    setCaption("");
    setProgress(0);
    setStage("uploading");
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
  }, [open]);

  function switchKind(next: PlayerMediaKind) {
    if (upload.isPending) return;
    setKind(next);
    setFile(null);
    setFileError(null);
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function choose(next: File | undefined) {
    setFileError(null);
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    if (!next) {
      setFile(null);
      return;
    }
    setChecking(true);
    try {
      await validatePlayerMedia(kind, next);
      setFile(next);
      setPreview(URL.createObjectURL(next));
    } catch (e) {
      setFile(null);
      setFileError(e instanceof Error ? e.message : "This file can't be used.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setChecking(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setFileError(kind === "photo" ? "Choose a photo to upload." : "Choose a video clip to upload.");
      return;
    }
    if (upload.isPending) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    setStage("uploading");
    try {
      await upload.mutateAsync({
        kind,
        file,
        title,
        caption,
        onProgress: setProgress,
        onStage: setStage,
        signal: controller.signal,
      });
      toast.success(kind === "photo" ? "Photo added to your media" : "Clip added to your media");
      onOpenChange(false);
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      abortRef.current = null;
    }
  }

  const busy = upload.isPending;
  const percent = Math.round(progress * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) {
          abortRef.current?.abort();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">Add media</DialogTitle>
          <DialogDescription>
            Football photos and short clips help clubs see how you play. Clips can be up to{" "}
            {MAX_VIDEO_SECONDS} seconds.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Media type">
            {(
              [
                { value: "photo", label: "Photo", hint: "JPG, PNG or WebP · up to 8 MB", Icon: ImageIcon },
                { value: "video", label: "Video clip", hint: `MP4, MOV or WebM · ${MAX_VIDEO_SECONDS}s max · large files compressed for you`, Icon: Film },
              ] as const
            ).map(({ value, label, hint, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                disabled={busy}
                onClick={() => switchKind(value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  kind === value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-elevated/40 hover:bg-elevated",
                )}
              >
                <Icon className={cn("size-5", kind === value ? "text-primary" : "text-muted-foreground")} />
                <p className="mt-2 text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </button>
            ))}
          </div>

          <Field label={kind === "photo" ? "Photo" : "Video clip"}>
            <input
              ref={inputRef}
              type="file"
              accept={kind === "photo" ? PHOTO_ACCEPT : VIDEO_ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
            <div
              className={cn(
                "relative grid aspect-[3/2] w-full place-items-center overflow-hidden rounded-xl border border-dashed bg-elevated/40",
                fileError ? "border-destructive" : "border-border",
              )}
            >
              {preview && file ? (
                kind === "photo" ? (
                  <img src={preview} alt="Selected photo preview" className="h-full w-full object-contain" />
                ) : (
                  <video src={preview} muted playsInline controls preload="metadata" className="h-full w-full object-contain" />
                )
              ) : (
                <div className="p-6 text-center">
                  {checking ? (
                    <LoaderCircle className="mx-auto size-6 animate-spin text-primary" />
                  ) : (
                    <Upload className="mx-auto size-6 text-muted-foreground" />
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {checking
                      ? "Checking file…"
                      : kind === "photo"
                        ? "No photo selected"
                        : "No clip selected"}
                  </p>
                </div>
              )}
              {busy ? (
                <div className="absolute inset-0 grid place-items-center bg-background/80 p-6">
                  <div className="w-full max-w-xs text-center">
                    <LoaderCircle className="mx-auto size-6 animate-spin text-primary" />
                    <p className="mt-2 text-sm font-semibold tabular-nums">
                      {stage === "compressing"
                        ? `Compressing video… ${percent}%`
                        : percent < 100
                          ? `Uploading… ${percent}%`
                          : "Saving…"}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="subtle"
                size="sm"
                disabled={busy || checking}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" /> {file ? "Choose a different file" : "Choose file"}
              </Button>
              {file ? (
                <span className="truncate text-xs text-muted-foreground">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              ) : null}
            </div>
            {fileError ? <p className="text-xs text-destructive">{fileError}</p> : null}
          </Field>

          <Field label="Title (optional)">
            <Input
              value={title}
              maxLength={MAX_MEDIA_TITLE}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "photo" ? "e.g. Cup final, May 2025" : "e.g. Free-kick v Harlow Town"}
            />
          </Field>

          <Field label="Caption (optional)" hint={`${caption.length}/${MAX_MEDIA_CAPTION}`}>
            <Textarea
              rows={3}
              value={caption}
              maxLength={MAX_MEDIA_CAPTION}
              disabled={busy}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="A line of context clubs will find useful."
            />
          </Field>

          <DialogFooter className="gap-2">
            <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
              {busy ? "Cancel upload" : "Cancel"}
            </Button>
            <Button type="submit" variant="volt" disabled={busy || checking || !file}>
              {busy
                ? stage === "compressing"
                  ? "Preparing video…"
                  : "Uploading…"
                : kind === "photo"
                  ? "Add photo"
                  : "Add clip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
