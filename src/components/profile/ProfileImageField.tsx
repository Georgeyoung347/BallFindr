/**
 * Upload/replace a profile photo or club badge into private storage (lib/profile-images).
 */
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateProfileImage } from "@/lib/profile-images";

export function ProfileImageField({
  label,
  hint,
  imageUrl,
  shape = "landscape",
  onChange,
}: {
  label: string;
  hint: string;
  imageUrl: string | null;
  shape?: "avatar" | "landscape";
  onChange: (file: File | null) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const displayed = preview ?? imageUrl;

  async function choose(file: File | undefined) {
    if (!file) return;
    try {
      validateProfileImage(file);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setBusy(true);
      await onChange(file);
      toast.success(`${label} updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not update ${label.toLowerCase()}.`);
    } finally {
      setBusy(false);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    try {
      setBusy(true);
      await onChange(null);
      toast.success(`${label} removed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not remove ${label.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border border-border bg-background text-muted-foreground",
            shape === "avatar" ? "size-20 rounded-2xl" : "aspect-[16/7] w-full rounded-lg sm:w-48",
          )}
        >
          {displayed ? (
            <img src={displayed} alt={`${label} preview`} className={cn("size-full object-cover", shape === "avatar" && "object-center")} />
          ) : (
            <ImagePlus className="size-6" />
          )}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-background/75">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void choose(event.target.files?.[0])}
            />
            <Button type="button" variant="subtle" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <ImagePlus className="size-4" /> {displayed ? "Change" : "Upload"}
            </Button>
            {displayed ? (
              <Button type="button" variant="quiet" size="sm" disabled={busy} onClick={() => void remove()}>
                <Trash2 className="size-4" /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}