/**
 * Add / edit dialog for one of the signed-in club's own season history
 * entries. Writes are scoped to the signed-in club; RLS enforces ownership.
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
import { usePlayerLevels } from "@/lib/player-profile";
import {
  clubOutcomeLabels,
  clubOutcomes,
  emptyClubHistoryForm,
  useDeleteClubHistoryEntry,
  useMyClubHistoryEntry,
  useSaveClubHistoryEntry,
  type ClubHistoryForm,
  type ClubOutcome,
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

export function ClubHistoryDialog({
  open,
  entryId,
  onOpenChange,
}: {
  open: boolean;
  /** null = create a new entry */
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = Boolean(entryId);
  const { data: loaded, isPending: loadingEntry } = useMyClubHistoryEntry(open ? entryId : null);
  const { data: levels = [] } = usePlayerLevels();
  const save = useSaveClubHistoryEntry();
  const remove = useDeleteClubHistoryEntry();
  const [form, setForm] = useState<ClubHistoryForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setConfirmDelete(false);
      return;
    }
    if (!entryId) setForm(emptyClubHistoryForm());
    else if (loaded) setForm(loaded);
  }, [open, entryId, loaded]);

  function update<K extends keyof ClubHistoryForm>(key: K, value: ClubHistoryForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      await save.mutateAsync({ id: entryId, form });
      toast.success(isEdit ? "Season updated" : "Season added");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this season.");
    }
  }

  async function onDelete() {
    if (!entryId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(entryId);
      toast.success("Season removed");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this season.");
    }
  }

  const busy = save.isPending || remove.isPending;
  const notFound = isEdit && !loadingEntry && loaded === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">
            {isEdit ? "Edit season" : "Add season"}
          </DialogTitle>
          <DialogDescription>
            One entry per season. Players viewing your club will see this.
          </DialogDescription>
        </DialogHeader>

        {notFound ? (
          <p className="py-6 text-sm text-muted-foreground">
            This season could not be found. It may have been removed.
          </p>
        ) : !form ? (
          <p className="py-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Season" hint="e.g. 2024 or 2023/24">
                <Input
                  value={form.season}
                  onChange={(e) => update("season", e.target.value)}
                  placeholder="2023/24"
                  required
                />
              </Field>
              <Field label="Level / Step">
                <select
                  className={selectClass}
                  value={form.levelId ?? ""}
                  onChange={(e) => update("levelId", e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Not set</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="League / competition">
                <Input
                  value={form.league}
                  onChange={(e) => update("league", e.target.value)}
                  placeholder="e.g. Western League Division One"
                  required
                />
              </Field>
              <Field label="Final position (optional)">
                <Input
                  value={form.finalPosition}
                  onChange={(e) => update("finalPosition", e.target.value)}
                  placeholder="e.g. 3rd"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {(["wins", "draws", "losses"] as const).map((key) => (
                <Field key={key} label={key === "wins" ? "W — Wins" : key === "draws" ? "D — Draws" : "L — Losses"}>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="0"
                  />
                </Field>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Season outcome">
                <select
                  className={selectClass}
                  value={form.outcome}
                  onChange={(e) => update("outcome", e.target.value as ClubOutcome)}
                >
                  {clubOutcomes.map((value) => (
                    <option key={value} value={value}>
                      {clubOutcomeLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cup run (optional)">
                <Input
                  value={form.cupAchievement}
                  onChange={(e) => update("cupAchievement", e.target.value)}
                  placeholder="e.g. County Cup semi-final"
                />
              </Field>
            </div>

            <Field label="Details (optional)">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Anything notable about the season."
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
                  {remove.isPending ? "Removing…" : confirmDelete ? "Confirm remove" : "Remove season"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="volt" disabled={busy}>
                  {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add season"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
