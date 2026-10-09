/**
 * Edit dialog for the signed-in club's own profile.
 * Every field maps directly to a profiles/clubs column; writes go through the
 * authenticated Supabase client so RLS (auth.uid() = id) applies.
 */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { ProfileImageField } from "@/components/profile/ProfileImageField";
import { trainingDayOptions, type TrainingDay } from "@/data/app-config";
import { usePlayerLevels } from "@/lib/player-profile";
import {
  facilityOptions,
  feePolicies,
  feePolicyLabels,
  toAmount,
  type FeePolicy,
} from "@/lib/club-extras";
import { CLUB_SECTIONS, type ClubSection } from "@/lib/football-section";
import {
  recruitmentStatusOptionLabels,
  recruitmentStatusValues,
  saveClubImage,
  useSaveClubProfile,
  useSignedInClubForm,
  type ClubProfileForm,
  type DbRecruitmentStatus,
} from "@/lib/club-profile";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

function ChoiceChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

export function ClubProfileEditDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: loaded, isPending } = useSignedInClubForm(open);
  const { data: levels = [] } = usePlayerLevels();
  const save = useSaveClubProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClubProfileForm | null>(null);

  useEffect(() => {
    if (open && loaded) setForm(loaded);
    if (!open) setForm(null);
  }, [open, loaded]);

  function update<K extends keyof ClubProfileForm>(key: K, value: ClubProfileForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleFacility(item: string) {
    if (!form) return;
    const next = form.facilities.includes(item)
      ? form.facilities.filter((f) => f !== item)
      : [...form.facilities, item];
    update("facilities", next);
  }

  function toggleDay(day: TrainingDay) {
    if (!form) return;
    const next = form.trainingDays.includes(day)
      ? form.trainingDays.filter((d) => d !== day)
      : [...form.trainingDays, day];
    update("trainingDays", next);
  }

  async function changeImage(
    slot: "badge" | "team" | "home-ground" | "training-pitch",
    file: File | null,
  ) {
    if (!form) return;
    const keys = {
      badge: ["badgePath", "badgeUrl"],
      team: ["teamPhotoPath", "teamPhotoUrl"],
      "home-ground": ["homeGroundPhotoPath", "homeGroundPhotoUrl"],
      "training-pitch": ["trainingPitchPhotoPath", "trainingPitchPhotoUrl"],
    } as const;
    const [pathKey, urlKey] = keys[slot];
    const result = await saveClubImage(slot, file, form[pathKey]);
    setForm((current) => current ? { ...current, [pathKey]: result.path, [urlKey]: result.url } : current);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["signed-in-club-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["discover-clubs"] }),
      queryClient.invalidateQueries({ queryKey: ["saved-clubs"] }),
      queryClient.invalidateQueries({ queryKey: ["my-applications"] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ]);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Please add your club name.");
      return;
    }
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      toast.error("Please enter a valid contact email.");
      return;
    }
    try {
      await save.mutateAsync({ ...form, displayName: form.name });
      toast.success("Club profile updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your club profile.");
    }
  }

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-base text-foreground md:text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">Edit club profile</DialogTitle>
          <DialogDescription>These details are what players see about your club.</DialogDescription>
        </DialogHeader>

        {isPending || !form ? (
          <p className="py-6 text-sm text-muted-foreground">Loading your club details…</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ProfileImageField label="Club badge" hint="A square badge or crest works best." imageUrl={form.badgeUrl} shape="avatar" onChange={(file) => changeImage("badge", file)} />
              <ProfileImageField label="Team photo" hint="A landscape photo of your squad." imageUrl={form.teamPhotoUrl} onChange={(file) => changeImage("team", file)} />
              <ProfileImageField label="Home Ground" hint="A landscape photo of your home venue." imageUrl={form.homeGroundPhotoUrl} onChange={(file) => changeImage("home-ground", file)} />
              <ProfileImageField label="Training Pitch" hint="A landscape photo of your training facilities." imageUrl={form.trainingPitchPhotoUrl} onChange={(file) => changeImage("training-pitch", file)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Club name">
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field label="Short name / initials" hint="Shown on your badge placeholder.">
                <Input
                  value={form.shortName}
                  onChange={(e) => update("shortName", e.target.value)}
                  placeholder="e.g. EFC"
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="e.g. Bristol"
                />
              </Field>
              <Field label="Home ground">
                <Input
                  value={form.homeGround}
                  onChange={(e) => update("homeGround", e.target.value)}
                />
              </Field>
              <Field label="Current league">
                <Input value={form.league} onChange={(e) => update("league", e.target.value)} />
              </Field>
              <Field label="Current level / Step">
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
              <Field
                label="Football section"
                hint="Which football your club operates. Choosing both keeps one account — you switch side from your dashboard."
              >
                <select
                  className={selectClass}
                  value={form.footballSection}
                  onChange={(e) => update("footballSection", e.target.value as ClubSection)}
                >
                  {CLUB_SECTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Founded">
                <Input
                  value={form.founded}
                  onChange={(e) => update("founded", e.target.value)}
                  placeholder="e.g. 1897"
                />
              </Field>
              <Field label="Match day">
                <Input
                  value={form.matchDay}
                  onChange={(e) => update("matchDay", e.target.value)}
                  placeholder="e.g. Saturday"
                />
              </Field>
              <Field label="Training location">
                <Input
                  value={form.trainingLocation}
                  onChange={(e) => update("trainingLocation", e.target.value)}
                />
              </Field>
              <Field label="Training time">
                <Input
                  value={form.trainingTime}
                  onChange={(e) => update("trainingTime", e.target.value)}
                  placeholder="e.g. 7:30pm"
                />
              </Field>
              <Field label="Recruitment status">
                <select
                  className={selectClass}
                  value={form.recruitmentStatus}
                  onChange={(e) =>
                    update("recruitmentStatus", e.target.value as DbRecruitmentStatus)
                  }
                >
                  {recruitmentStatusValues.map((value) => (
                    <option key={value} value={value}>
                      {recruitmentStatusOptionLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Training days">
              <div className="flex flex-wrap gap-2">
                {trainingDayOptions.map((day) => (
                  <ChoiceChip
                    key={day}
                    active={form.trainingDays.includes(day)}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </ChoiceChip>
                ))}
              </div>
            </Field>

            <Field label="Fees" hint="Players see this before contacting you.">
              <select
                className={selectClass}
                value={form.feesPolicy ?? ""}
                onChange={(e) => update("feesPolicy", (e.target.value || null) as FeePolicy | null)}
              >
                <option value="">Not provided</option>
                {feePolicies.map((value) => (
                  <option key={value} value={value}>
                    {feePolicyLabels[value]}
                  </option>
                ))}
              </select>
            </Field>

            {form.feesPolicy === "listed" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Match subs (£)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.matchSubsFee ?? ""}
                    onChange={(e) => update("matchSubsFee", toAmount(e.target.value))}
                    placeholder="e.g. 5"
                  />
                </Field>
                <Field label="Monthly fee (£)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.monthlyFee ?? ""}
                    onChange={(e) => update("monthlyFee", toAmount(e.target.value))}
                    placeholder="e.g. 25"
                  />
                </Field>
                <Field label="Yearly fee (£)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.yearlyFee ?? ""}
                    onChange={(e) => update("yearlyFee", toAmount(e.target.value))}
                    placeholder="e.g. 150"
                  />
                </Field>
                <Field label="Other fee (£)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.otherFee ?? ""}
                    onChange={(e) => update("otherFee", toAmount(e.target.value))}
                  />
                </Field>
                <Field label="Other fee name" hint="What the other fee covers.">
                  <Input
                    value={form.otherFeeLabel}
                    onChange={(e) => update("otherFeeLabel", e.target.value)}
                    placeholder="e.g. Registration fee"
                  />
                </Field>
              </div>
            ) : null}

            <Field label="Facilities & benefits">
              <div className="flex flex-wrap gap-2">
                {facilityOptions.map((item) => (
                  <ChoiceChip
                    key={item}
                    active={form.facilities.includes(item)}
                    onClick={() => toggleFacility(item)}
                  >
                    {item}
                  </ChoiceChip>
                ))}
              </div>
            </Field>

            <Field label="Other facility or benefit">
              <Input
                value={form.facilitiesOther}
                onChange={(e) => update("facilitiesOther", e.target.value)}
                placeholder="e.g. Free post-match meal"
              />
            </Field>

            <Field label="About the club">
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Your club's story, ambitions and set-up."
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Contact name">
                <Input
                  value={form.contactName}
                  onChange={(e) => update("contactName", e.target.value)}
                />
              </Field>
              <Field label="Contact role">
                <Input
                  value={form.contactRole}
                  onChange={(e) => update("contactRole", e.target.value)}
                  placeholder="e.g. First team manager"
                />
              </Field>
              <Field label="Contact email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => update("contactEmail", e.target.value)}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="volt" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save club profile"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
