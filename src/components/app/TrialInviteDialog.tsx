/**
 * Club-side "Invite to trial" form. Only ever opened for an application that
 * already exists between this club and the player (the database enforces this
 * again). On success the application moves to "Trial invited" via triggers.
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
import {
  emptyTrialInviteForm,
  trialInviteSchema,
  trialSurfaceOptions,
  useCreateTrialInvite,
  type TrialInviteFormInput,
  type TrialSurface,
} from "@/lib/trial-invites";

type Errors = Partial<Record<keyof TrialInviteFormInput, string>>;

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
        {required ? <span className="ml-0.5 text-destructive" aria-hidden="true">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

export function TrialInviteDialog({
  open,
  onOpenChange,
  applicationId,
  playerId,
  playerName,
  vacancyLabel,
}: {
  playerId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null;
  playerName: string;
  vacancyLabel?: string | null | undefined;
}) {
  const create = useCreateTrialInvite();
  const [form, setForm] = useState<TrialInviteFormInput>(emptyTrialInviteForm);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) {
      setForm(emptyTrialInviteForm());
      setErrors({});
    }
  }, [open]);

  function update<K extends keyof TrialInviteFormInput>(key: K, value: TrialInviteFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!applicationId && !playerId) return;
    const parsed = trialInviteSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof TrialInviteFormInput | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    try {
      await create.mutateAsync({ applicationId, playerId: playerId ?? null, values: parsed.data });
      toast.success(`Trial invitation sent to ${playerName}`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't send the trial invitation", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">Invite {playerName} to trial</DialogTitle>
          <DialogDescription>
            {vacancyLabel ? `${vacancyLabel} · ` : ""}
            These are the exact details {playerName} will use to attend the trial, so please make
            sure the date, time and address are correct.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={onSubmit} noValidate>
          <section className="space-y-4">
            <p className="eyebrow">When</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field required label="Trial date" error={errors.trialDate}>
                <Input
                  type="date"
                  value={form.trialDate}
                  onChange={(e) => update("trialDate", e.target.value)}
                  required
                />
              </Field>
              <Field required label="Start time" error={errors.startTime}>
                <Input type="time" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} required />
              </Field>
              <Field required label="End time" error={errors.endTime}>
                <Input type="time" value={form.endTime} onChange={(e) => update("endTime", e.target.value)} required />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Expected arrival (optional)" error={errors.arrivalTime} hint="When the player should get there.">
                <Input type="time" value={form.arrivalTime} onChange={(e) => update("arrivalTime", e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Where</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field required label="Pitch / surface" error={errors.surface}>
                <select
                  className={selectClass}
                  value={form.surface}
                  onChange={(e) => update("surface", e.target.value as TrialSurface)}
                >
                  {trialSurfaceOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.surface === "other" ? (
                <Field required label="Describe the surface" error={errors.surfaceOther}>
                  <Input
                    value={form.surfaceOther}
                    onChange={(e) => update("surfaceOther", e.target.value)}
                    placeholder="e.g. Hybrid turf"
                  />
                </Field>
              ) : null}
            </div>
            <Field required label="Venue / ground name" error={errors.venueName}>
              <Input
                value={form.venueName}
                onChange={(e) => update("venueName", e.target.value)}
                placeholder="e.g. The Meadow"
                required
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <Field required label="Street / road" error={errors.streetAddress}>
                <Input
                  value={form.streetAddress}
                  onChange={(e) => update("streetAddress", e.target.value)}
                  placeholder="e.g. 12 Meadow Lane"
                  required
                />
              </Field>
              <Field required label="Postcode" error={errors.postcode}>
                <Input
                  value={form.postcode}
                  onChange={(e) => update("postcode", e.target.value)}
                  placeholder="e.g. BS1 4DJ"
                  autoCapitalize="characters"
                  required
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Helpful for the player (optional)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="What to bring" error={errors.whatToBring}>
                <Textarea rows={2} value={form.whatToBring} onChange={(e) => update("whatToBring", e.target.value)} placeholder="Boots for 3G, shin pads, water" />
              </Field>
              <Field label="Kit / dress instructions" error={errors.kitInstructions}>
                <Textarea rows={2} value={form.kitInstructions} onChange={(e) => update("kitInstructions", e.target.value)} placeholder="Training kit provided, bring your own boots" />
              </Field>
              <Field label="Changing rooms / showers" error={errors.changingInfo}>
                <Textarea rows={2} value={form.changingInfo} onChange={(e) => update("changingInfo", e.target.value)} placeholder="Changing rooms and showers available on site" />
              </Field>
              <Field label="Additional instructions" error={errors.additionalInstructions}>
                <Textarea rows={2} value={form.additionalInstructions} onChange={(e) => update("additionalInstructions", e.target.value)} placeholder="Parking, which entrance to use, who to ask for" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Contact person" error={errors.contactName}>
                <Input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="e.g. Sam Jones, first-team manager" />
              </Field>
              <Field label="Contact phone" error={errors.contactPhone}>
                <Input type="tel" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="e.g. 07700 900123" />
              </Field>
            </div>
            <Field label="Additional notes" error={errors.notes}>
              <Textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Anything else the player should know" />
            </Field>
          </section>

          <DialogFooter className="gap-2">
            <Button type="button" variant="subtle" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="volt" disabled={create.isPending || (!applicationId && !playerId)}>
              {create.isPending ? "Sending…" : "Send trial invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
