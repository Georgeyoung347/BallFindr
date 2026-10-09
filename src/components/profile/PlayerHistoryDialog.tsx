/**
 * Add / edit dialog for one of the signed-in player's own playing-history
 * entries. Writes are scoped to the signed-in user; RLS enforces ownership.
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { dbPositions, usePlayerLevels, type DbPosition } from "@/lib/player-profile";
import {
  MIN_HISTORY_YEAR,
  currentYear,
  emptyHistoryForm,
  useDeleteHistoryEntry,
  useMyHistoryEntry,
  useSaveHistoryEntry,
  type PlayerHistoryForm,
} from "@/lib/player-cv";

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

function toInt(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function PlayerHistoryDialog({
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
  const { data: loaded, isPending: loadingEntry } = useMyHistoryEntry(open ? entryId : null);
  const { data: levels = [] } = usePlayerLevels();
  const save = useSaveHistoryEntry();
  const remove = useDeleteHistoryEntry();
  const [form, setForm] = useState<PlayerHistoryForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setConfirmDelete(false);
      return;
    }
    if (!entryId) setForm(emptyHistoryForm());
    else if (loaded) setForm(loaded);
  }, [open, entryId, loaded]);

  function update<K extends keyof PlayerHistoryForm>(key: K, value: PlayerHistoryForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      await save.mutateAsync({ id: entryId, form });
      toast.success(isEdit ? "History updated" : "History added");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this entry.");
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
      toast.success("History entry removed");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this entry.");
    }
  }

  const busy = save.isPending || remove.isPending;
  const notFound = isEdit && !loadingEntry && loaded === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">
            {isEdit ? "Edit playing history" : "Add playing history"}
          </DialogTitle>
          <DialogDescription>
            One entry per club spell. Clubs viewing your profile will see this.
          </DialogDescription>
        </DialogHeader>

        {notFound ? (
          <p className="py-6 text-sm text-muted-foreground">
            This entry could not be found. It may have been removed.
          </p>
        ) : !form ? (
          <p className="py-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Club / team">
                <Input
                  value={form.clubName}
                  onChange={(e) => update("clubName", e.target.value)}
                  placeholder="e.g. Example FC"
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
              <Field label="Start year">
                <Input
                  type="number"
                  min={MIN_HISTORY_YEAR}
                  max={currentYear() + 1}
                  value={form.startYear ?? ""}
                  onChange={(e) => update("startYear", toInt(e.target.value))}
                  placeholder={String(currentYear())}
                  required
                />
              </Field>
              <Field label="End year" {...(form.isCurrent ? { hint: "Ongoing — shown as Present." } : {})}>
                <Input
                  type="number"
                  min={MIN_HISTORY_YEAR}
                  max={currentYear() + 1}
                  value={form.isCurrent ? "" : (form.endYear ?? "")}
                  onChange={(e) => update("endYear", toInt(e.target.value))}
                  disabled={form.isCurrent}
                  placeholder={form.isCurrent ? "Present" : String(currentYear())}
                />
              </Field>
            </div>

            <label className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-elevated/60 px-3 py-2 text-sm">
              This is my current club
              <Switch
                checked={form.isCurrent}
                onCheckedChange={(checked) => update("isCurrent", checked)}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Position">
                <select
                  className={selectClass}
                  value={form.position ?? ""}
                  onChange={(e) => update("position", (e.target.value || null) as DbPosition | null)}
                >
                  <option value="">Not set</option>
                  {dbPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="League (optional)">
                <Input
                  value={form.league}
                  onChange={(e) => update("league", e.target.value)}
                  placeholder="e.g. Western League Division One"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Appearances">
                <Input
                  type="number"
                  min={0}
                  max={2000}
                  value={form.appearances ?? ""}
                  onChange={(e) => update("appearances", toInt(e.target.value))}
                />
              </Field>
              {form.position === "GK" ? (
                <>
                  <Field label="Clean Sheets">
                    <Input
                      type="number"
                      min={0}
                      max={2000}
                      value={form.cleanSheets ?? ""}
                      onChange={(e) => update("cleanSheets", toInt(e.target.value))}
                    />
                  </Field>
                  <Field label="G/A" hint="Goals against.">
                    <Input
                      type="number"
                      min={0}
                      max={2000}
                      value={form.goalsAgainst ?? ""}
                      onChange={(e) => update("goalsAgainst", toInt(e.target.value))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Goals">
                    <Input
                      type="number"
                      min={0}
                      max={2000}
                      value={form.goals ?? ""}
                      onChange={(e) => update("goals", toInt(e.target.value))}
                    />
                  </Field>
                  <Field label="Assists">
                    <Input
                      type="number"
                      min={0}
                      max={2000}
                      value={form.assists ?? ""}
                      onChange={(e) => update("assists", toInt(e.target.value))}
                    />
                  </Field>
                </>
              )}
            </div>

            <Field label="Details (optional)">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Role in the squad, captaincy, standout moments."
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
                  {remove.isPending ? "Removing…" : confirmDelete ? "Confirm remove" : "Remove entry"}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="volt" disabled={busy}>
                  {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add entry"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
