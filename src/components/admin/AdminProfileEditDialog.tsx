/**
 * Admin dialog for reviewing/editing a player's or club's profile fields. Saves through admin-profile-edit server functions so every change is authorised server-side and logged.
 */
import { ClubStatusChoice, FREE_AGENT, isFreeAgent } from "@/components/profile/ClubStatusChoice";
import { AdminEmailField } from "@/components/admin/AdminEmailField";
/**
 * Admin-only profile editor for a player or club. Loads values through an
 * admin-checked server function, shows a review of the changes, and only then
 * saves (server re-checks admin, writes changed fields only, records history).
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { availabilityLabels, trainingDayOptions } from "@/data/app-config";
import { dbAvailabilityOptions, dbPositions, formatHeight, usePlayerLevels } from "@/lib/player-profile";
import { facilityOptions, feePolicies, feePolicyLabels } from "@/lib/club-extras";
import { recruitmentStatusOptionLabels, recruitmentStatusValues } from "@/lib/club-profile";
import {
  adminClubFieldLabels,
  adminPlayerFieldLabels,
  getAdminEditableProfile,
  saveAdminProfileEdit,
  type AdminClubForm,
  type AdminPlayerForm,
} from "@/lib/admin-profile-edit.functions";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-elevated/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function same(a: unknown, b: unknown) {
  const norm = (v: unknown) =>
    Array.isArray(v) ? [...v].map(String).sort() : typeof v === "string" ? v.trim() || null : v ?? null;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

type Values = AdminPlayerForm | AdminClubForm;

export function AdminProfileEditDialog({
  profileId,
  open,
  onOpenChange,
}: {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminEditableProfile);
  const saveFn = useServerFn(saveAdminProfileEdit);
  const { data: levels = [] } = usePlayerLevels();
  const { data, isPending, error } = useQuery({
    queryKey: ["admin", "edit-profile", profileId],
    queryFn: () => load({ data: { profileId } }),
    enabled: open,
    staleTime: 0,
  });

  const kind = data?.kind;
  const original = (data?.player ?? data?.club ?? null) as Values | null;
  const [form, setForm] = useState<Values | null>(null);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (open && original) setForm(original);
    if (!open) {
      setForm(null);
      setReviewing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const labels = kind === "club" ? adminClubFieldLabels : adminPlayerFieldLabels;
  const diff = useMemo(() => {
    if (!form || !original) return [];
    return Object.keys(labels)
      .filter((k) => !same((original as any)[k], (form as any)[k]))
      .map((k) => ({ key: k, label: labels[k]!, from: (original as any)[k], to: (form as any)[k] }));
  }, [form, original, labels]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { kind: kind!, profileId, values: form as any } }),
    onSuccess: (res) => {
      toast.success(res.changed.length ? `Profile updated (${res.changed.length} field${res.changed.length === 1 ? "" : "s"})` : "No changes to save");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the profile"),
  });

  function set<K extends string>(key: K, value: unknown) {
    setForm((prev) => (prev ? ({ ...prev, [key]: value } as Values) : prev));
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (kind === "player" && !(form as AdminPlayerForm).displayName.trim()) return void toast.error("Name is required.");
    if (kind === "club" && !(form as AdminClubForm).name.trim()) return void toast.error("Club name is required.");
    if (diff.length === 0) return void toast.message("Nothing has changed yet.");
    setReviewing(true);
  }

  const p = kind === "player" ? (form as AdminPlayerForm | null) : null;
  const c = kind === "club" ? (form as AdminClubForm | null) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">
            {reviewing ? "Review changes" : "Edit profile"}
          </DialogTitle>
          <DialogDescription>
            {reviewing
              ? "Check these changes before saving. They will be recorded in the moderation history."
              : "Admin edit. Account type, football section, verification, Owner Status, Founder Club and roles are not changed here."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="py-6 text-sm text-destructive">Could not load this profile.</p>
        ) : isPending || !form ? (
          <p className="py-6 text-sm text-muted-foreground">Loading profile…</p>
        ) : reviewing ? (
          <div className="space-y-4">
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {diff.map((d) => (
                <li key={d.key} className="space-y-1 p-3">
                  <p className="font-semibold">{d.label}</p>
                  <p className="break-words text-muted-foreground line-through">{show(d.from)}</p>
                  <p className="break-words text-foreground">{show(d.to)}</p>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => setReviewing(false)} disabled={save.isPending}>
                Back to editing
              </Button>
              <Button type="button" variant="volt" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : `Confirm & save ${diff.length} change${diff.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={review}>
            <AdminEmailField profileId={profileId} />
            {p ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <Input value={p.displayName} onChange={(e) => set("displayName", e.target.value)} required />
                  </Field>
                  <Field label="Date of birth" hint="Must be 16 or over.">
                    <Input type="date" value={p.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                  </Field>
                  <Field label="Location">
                    <Input value={p.location} onChange={(e) => set("location", e.target.value)} />
                  </Field>
                  <ClubStatusChoice value={!isFreeAgent(p.currentClubName)}
                    onChange={(v) => { set("currentClubName", v ? "" : FREE_AGENT); if (!v) set("levelId", null); }} />
                  {!isFreeAgent(p.currentClubName) ? (<>
                  <Field label="Current club">
                    <Input value={p.currentClubName} onChange={(e) => set("currentClubName", e.target.value)} />
                  </Field>
                  <Field label="Current level / Step">
                    <select className={selectClass} value={p.levelId ?? ""} onChange={(e) => set("levelId", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Not set</option>
                      {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                  </>) : null}
                  <Field label="Preferred playing level">
                    <select className={selectClass} value={p.preferredLevelId ?? ""} onChange={(e) => set("preferredLevelId", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Not set</option>
                      {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Primary position">
                    <select className={selectClass} value={p.primaryPosition ?? ""} onChange={(e) => set("primaryPosition", e.target.value || null)}>
                      <option value="">Not set</option>
                      {dbPositions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  </Field>
                  <Field label="Availability">
                    <select className={selectClass} value={p.availability} onChange={(e) => set("availability", e.target.value)}>
                      {dbAvailabilityOptions.map((v) => <option key={v} value={v}>{availabilityLabels[v]}</option>)}
                    </select>
                  </Field>
                  <Field label="Height" hint={p.heightInches !== null ? formatHeight(p.heightInches) ?? "Out of range" : "Optional"}>
                    <div className="flex gap-2">
                      <select
                        className={cn(selectClass, "w-24")}
                        value={p.heightInches === null ? "" : Math.floor(p.heightInches / 12)}
                        onChange={(e) =>
                          set("heightInches", e.target.value === "" ? null : Number(e.target.value) * 12 + (p.heightInches === null ? 0 : p.heightInches % 12))
                        }
                      >
                        <option value="">Not set</option>
                        {[4, 5, 6, 7].map((f) => <option key={f} value={f}>{f} ft</option>)}
                      </select>
                      <select
                        className={cn(selectClass, "w-24")}
                        disabled={p.heightInches === null}
                        value={p.heightInches === null ? 0 : p.heightInches % 12}
                        onChange={(e) => p.heightInches !== null && set("heightInches", Math.floor(p.heightInches / 12) * 12 + Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i} in</option>)}
                      </select>
                    </div>
                  </Field>
                  <Field label="Maximum travel (miles)">
                    <Input type="number" min={0} max={500} value={p.maxTravelMiles ?? ""} onChange={(e) => set("maxTravelMiles", numOrNull(e.target.value))} />
                  </Field>
                </div>
                <Field label="Secondary positions" hint="Optional.">
                  <div className="flex flex-wrap gap-2">
                    {dbPositions.map((pos) => (
                      <Chip key={pos} active={p.secondaryPositions.includes(pos)} onClick={() => set("secondaryPositions", toggle(p.secondaryPositions, pos))}>{pos}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Preferred training days">
                  <div className="flex flex-wrap gap-2">
                    {trainingDayOptions.map((d) => (
                      <Chip key={d} active={p.preferredTrainingDays.includes(d)} onClick={() => set("preferredTrainingDays", toggle(p.preferredTrainingDays, d))}>{d}</Chip>
                    ))}
                  </div>
                </Field>
                <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-elevated/60 px-3 py-2 text-sm">
                  Open to trials
                  <Switch checked={p.openToTrials} onCheckedChange={(v) => set("openToTrials", v)} />
                </label>
                <Field label="Player bio">
                  <Textarea rows={4} value={p.bio} onChange={(e) => set("bio", e.target.value)} />
                </Field>
                <Field label="What they're looking for">
                  <Textarea rows={3} value={p.lookingFor} onChange={(e) => set("lookingFor", e.target.value)} />
                </Field>
              </>
            ) : c ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Club name">
                    <Input value={c.name} onChange={(e) => set("name", e.target.value)} required />
                  </Field>
                  <Field label="Short name">
                    <Input value={c.shortName} maxLength={10} onChange={(e) => set("shortName", e.target.value)} />
                  </Field>
                  <Field label="Location">
                    <Input value={c.location} onChange={(e) => set("location", e.target.value)} />
                  </Field>
                  <Field label="Home ground">
                    <Input value={c.homeGround} onChange={(e) => set("homeGround", e.target.value)} />
                  </Field>
                  <Field label="League">
                    <Input value={c.league} onChange={(e) => set("league", e.target.value)} />
                  </Field>
                  <Field label="Level / Step">
                    <select className={selectClass} value={c.levelId ?? ""} onChange={(e) => set("levelId", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Not set</option>
                      {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Founded">
                    <Input value={c.founded} onChange={(e) => set("founded", e.target.value)} />
                  </Field>
                  <Field label="Recruitment status">
                    <select className={selectClass} value={c.recruitmentStatus} onChange={(e) => set("recruitmentStatus", e.target.value)}>
                      {recruitmentStatusValues.map((v) => <option key={v} value={v}>{recruitmentStatusOptionLabels[v]}</option>)}
                    </select>
                  </Field>
                  <Field label="Match days">
                    <Input value={c.matchDay} onChange={(e) => set("matchDay", e.target.value)} />
                  </Field>
                  <Field label="Training time">
                    <Input value={c.trainingTime} onChange={(e) => set("trainingTime", e.target.value)} />
                  </Field>
                  <Field label="Training location">
                    <Input value={c.trainingLocation} onChange={(e) => set("trainingLocation", e.target.value)} />
                  </Field>
                </div>
                <Field label="Training days">
                  <div className="flex flex-wrap gap-2">
                    {trainingDayOptions.map((d) => (
                      <Chip key={d} active={c.trainingDays.includes(d)} onClick={() => set("trainingDays", toggle(c.trainingDays, d))}>{d}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="About the club">
                  <Textarea rows={4} value={c.description} onChange={(e) => set("description", e.target.value)} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Contact name">
                    <Input value={c.contactName} onChange={(e) => set("contactName", e.target.value)} />
                  </Field>
                  <Field label="Contact role">
                    <Input value={c.contactRole} onChange={(e) => set("contactRole", e.target.value)} />
                  </Field>
                  <Field label="Contact email">
                    <Input type="email" value={c.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
                  </Field>
                </div>
                <Field label="Fees">
                  <select className={selectClass} value={c.feesPolicy ?? ""} onChange={(e) => set("feesPolicy", e.target.value || null)}>
                    <option value="">Not set</option>
                    {feePolicies.map((v) => <option key={v} value={v}>{feePolicyLabels[v]}</option>)}
                  </select>
                </Field>
                {c.feesPolicy === "listed" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {([["matchSubsFee", "Match subs (£)"], ["monthlyFee", "Monthly (£)"], ["yearlyFee", "Yearly (£)"], ["otherFee", "Other (£)"]] as const).map(([k, l]) => (
                      <Field key={k} label={l}>
                        <Input type="number" min={0} step="0.01" value={c[k] ?? ""} onChange={(e) => set(k, numOrNull(e.target.value))} />
                      </Field>
                    ))}
                    <Field label="Other fee label">
                      <Input value={c.otherFeeLabel} onChange={(e) => set("otherFeeLabel", e.target.value)} />
                    </Field>
                  </div>
                ) : null}
                <Field label="Facilities">
                  <div className="flex flex-wrap gap-2">
                    {facilityOptions.map((f) => (
                      <Chip key={f} active={c.facilities.includes(f)} onClick={() => set("facilities", toggle(c.facilities, f))}>{f}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Other facilities">
                  <Input value={c.facilitiesOther} onChange={(e) => set("facilitiesOther", e.target.value)} />
                </Field>
              </>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="volt">Review changes</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
