/**
 * Add / edit dialog for one of the signed-in club's own achievements.
 * Uses the existing achievement_kind configuration; RLS enforces ownership.
 */

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
import { achievementKindLabels, type AchievementKind } from "@/data/profile-model";
import {
  clubAchievementKinds,
  emptyClubAchievementForm,
  useDeleteClubAchievement,
  useMyClubAchievement,
  useSaveClubAchievement,
  type ClubAchievementForm,
} from "@/lib/club-cv";

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

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

export function ClubAchievementDialog({
  open,
  achievementId,
  onOpenChange,
}: {
  open: boolean;
  /** null = create a new achievement */
  achievementId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = Boolean(achievementId);
  const { data: loaded, isPending: loading } = useMyClubAchievement(open ? achievementId : null);
  const save = useSaveClubAchievement();
  const remove = useDeleteClubAchievement();
  const [form, setForm] = useState<ClubAchievementForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setConfirmDelete(false);
      return;
    }
    if (!achievementId) setForm(emptyClubAchievementForm());
    else if (loaded) setForm(loaded);
  }, [open, achievementId, loaded]);

  function update<K extends keyof ClubAchievementForm>(key: K, value: ClubAchievementForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      await save.mutateAsync({ id: achievementId, form });
      toast.success(isEdit ? "Achievement updated" : "Achievement added");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this achievement.");
    }
  }

  async function onDelete() {
    if (!achievementId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(achievementId);
      toast.success("Achievement removed");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this achievement.");
    }
  }

  const busy = save.isPending || remove.isPending;
  const notFound = isEdit && !loading && loaded === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">
            {isEdit ? "Edit club achievement" : "Add club achievement"}
          </DialogTitle>
          <DialogDescription>
            Promotions, league titles, cup wins and major honours.
          </DialogDescription>
        </DialogHeader>

        {notFound ? (
          <p className="py-6 text-sm text-muted-foreground">
            This achievement could not be found. It may have been removed.
          </p>
        ) : !form ? (
          <p className="py-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type">
                <select
                  className={selectClass}
                  value={form.kind}
                  onChange={(e) => update("kind", e.target.value as AchievementKind)}
                >
                  {clubAchievementKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {achievementKindLabels[kind]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Season / year" hint="e.g. 2024 or 2023/24">
                <Input
                  value={form.season}
                  onChange={(e) => update("season", e.target.value)}
                  placeholder="2023/24"
                />
              </Field>
            </div>

            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Division One champions"
                required
              />
            </Field>

            <Field label="Details (optional)">
              <Textarea
                rows={3}
                value={form.detail}
                onChange={(e) => update("detail", e.target.value)}
                placeholder="A line of context players will find useful."
              />
            </Field>

            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant={confirmDelete ? "destructive" : "subtle"}
                  onClick={onDelete}
                  disabled={busy}
                >
                  {remove.isPending ? "Removing…" : confirmDelete ? "Confirm remove" : "Remove"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="volt" disabled={busy}>
                  {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add achievement"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
