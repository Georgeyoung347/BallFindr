/**
 * Player Edit Profile dialog: edits core info/bio and saves to the players/profiles tables via lib/player-profile (RLS: owner only).
 */
import { ClubStatusChoice, FREE_AGENT, isFreeAgent } from "@/components/profile/ClubStatusChoice";
/**
 * Edit dialog for the signed-in player's own profile.
 * Every field maps directly to a profiles/players column; writes go through
 * the authenticated Supabase client so RLS (auth.uid() = id) applies.
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ProfileImageField } from "@/components/profile/ProfileImageField";
import { availabilityLabels, trainingDayOptions, type TrainingDay } from "@/data/app-config";
import {
  dbAvailabilityOptions,
  dbPositions,
  MAX_HEIGHT_INCHES,
  MIN_HEIGHT_INCHES,
  usePlayerLevels,
  useSavePlayerProfile,
  useSignedInPlayerForm,
  type DbAvailability,
  type DbPosition,
  formatHeight,
  savePlayerImage,
  type PlayerProfileForm,
} from "@/lib/player-profile";

const feetOptions = [4, 5, 6, 7];
const inchOptions = Array.from({ length: 12 }, (_, i) => i);

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

export function PlayerProfileEditDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: loaded, isPending } = useSignedInPlayerForm(open);
  const { data: levels = [] } = usePlayerLevels();
  const save = useSavePlayerProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlayerProfileForm | null>(null);

  useEffect(() => {
    if (open && loaded) setForm(loaded);
    if (!open) setForm(null);
  }, [open, loaded]);

  function update<K extends keyof PlayerProfileForm>(key: K, value: PlayerProfileForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleSecondary(pos: DbPosition) {
    if (!form) return;
    const next = form.secondaryPositions.includes(pos)
      ? form.secondaryPositions.filter((p) => p !== pos)
      : [...form.secondaryPositions, pos];
    update("secondaryPositions", next);
  }

  function toggleDay(day: TrainingDay) {
    if (!form) return;
    const next = form.preferredTrainingDays.includes(day)
      ? form.preferredTrainingDays.filter((d) => d !== day)
      : [...form.preferredTrainingDays, day];
    update("preferredTrainingDays", next);
  }

  async function changeImage(slot: "avatar" | "cover", file: File | null) {
    if (!form) return;
    const pathKey = slot === "avatar" ? "avatarPath" : "coverPath";
    const urlKey = slot === "avatar" ? "avatarUrl" : "coverUrl";
    const result = await savePlayerImage(slot, file, form[pathKey]);
    setForm((current) => current ? { ...current, [pathKey]: result.path, [urlKey]: result.url } : current);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["signed-in-player-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["discover-players"] }),
      queryClient.invalidateQueries({ queryKey: ["club-applications"] }),
      queryClient.invalidateQueries({ queryKey: ["saved-players"] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ]);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.displayName.trim()) {
      toast.error("Please add your name.");
      return;
    }
    if (
      form.heightInches !== null &&
      (!Number.isInteger(form.heightInches) ||
        form.heightInches < MIN_HEIGHT_INCHES ||
        form.heightInches > MAX_HEIGHT_INCHES)
    ) {
      toast.error("Please choose a height between 4'0\" and 7'6\".");
      return;
    }
    if (form.maxTravelMiles !== null && (form.maxTravelMiles < 0 || form.maxTravelMiles > 500)) {
      toast.error("Maximum travel should be between 0 and 500 miles.");
      return;
    }
    try {
      await save.mutateAsync(form);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    }
  }

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-base text-foreground md:text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase">Edit profile</DialogTitle>
          <DialogDescription>
            These details are what clubs see when they find you.
          </DialogDescription>
        </DialogHeader>

        {isPending || !form ? (
          <p className="py-6 text-sm text-muted-foreground">Loading your details…</p>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ProfileImageField
                label="Profile picture"
                hint="JPG, PNG or WebP. Maximum 8 MB."
                imageUrl={form.avatarUrl}
                shape="avatar"
                onChange={(file) => changeImage("avatar", file)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={form.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                  required
                />
              </Field>
              <Field label="Date of birth" hint="Only your age is shown to clubs.">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="e.g. Bristol"
                />
              </Field>
              <ClubStatusChoice
                value={!isFreeAgent(form.currentClubName)}
                onChange={(v) => {
                  update("currentClubName", v ? "" : FREE_AGENT);
                  if (!v) update("levelId", null);
                }}
              />
              {!isFreeAgent(form.currentClubName) ? (<>
              <Field label="Current club">
                <Input
                  value={form.currentClubName}
                  onChange={(e) => update("currentClubName", e.target.value)}
                  placeholder="e.g. Example FC"
                />
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
              </>) : null}
              <Field label="Preferred playing level">
                <select
                  className={selectClass}
                  value={form.preferredLevelId ?? ""}
                  onChange={(e) =>
                    update("preferredLevelId", e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Not set</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary position">
                <select
                  className={selectClass}
                  value={form.primaryPosition ?? ""}
                  onChange={(e) =>
                    update("primaryPosition", (e.target.value || null) as DbPosition | null)
                  }
                >
                  <option value="">Not set</option>
                  {dbPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Availability">
                <select
                  className={selectClass}
                  value={form.availability}
                  onChange={(e) => update("availability", e.target.value as DbAvailability)}
                >
                  {dbAvailabilityOptions.map((value) => (
                    <option key={value} value={value}>
                      {availabilityLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Secondary positions">
              <div className="flex flex-wrap gap-2">
                {dbPositions.map((pos) => (
                  <ChoiceChip
                    key={pos}
                    active={form.secondaryPositions.includes(pos)}
                    onClick={() => toggleSecondary(pos)}
                  >
                    {pos}
                  </ChoiceChip>
                ))}
              </div>
            </Field>

            <Field label="Preferred training days">
              <div className="flex flex-wrap gap-2">
                {trainingDayOptions.map((day) => (
                  <ChoiceChip
                    key={day}
                    active={form.preferredTrainingDays.includes(day)}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </ChoiceChip>
                ))}
              </div>
            </Field>

            <Field label="Height" hint="Optional. Shown on your profile as feet and inches.">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={cn(selectClass, "w-24")}
                  value={form.heightInches === null ? "" : Math.floor(form.heightInches / 12)}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      update("heightInches", null);
                      return;
                    }
                    const feet = Number(e.target.value);
                    const inches = form.heightInches === null ? 0 : form.heightInches % 12;
                    update("heightInches", feet * 12 + inches);
                  }}
                >
                  <option value="">Not set</option>
                  {feetOptions.map((f) => (
                    <option key={f} value={f}>
                      {f} ft
                    </option>
                  ))}
                </select>
                <select
                  className={cn(selectClass, "w-24")}
                  disabled={form.heightInches === null}
                  value={form.heightInches === null ? 0 : form.heightInches % 12}
                  onChange={(e) => {
                    if (form.heightInches === null) return;
                    const feet = Math.floor(form.heightInches / 12);
                    update("heightInches", feet * 12 + Number(e.target.value));
                  }}
                >
                  {inchOptions.map((i) => (
                    <option key={i} value={i}>
                      {i} in
                    </option>
                  ))}
                </select>
                {form.heightInches !== null ? (
                  <span className="text-sm text-muted-foreground">
                    {formatHeight(form.heightInches) ?? "Out of range"}
                  </span>
                ) : null}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Maximum travel (miles)">
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={form.maxTravelMiles ?? ""}
                  onChange={(e) =>
                    update("maxTravelMiles", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </Field>
              <div className="flex items-end">
                <label className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-elevated/60 px-3 py-2 text-sm">
                  Open to trials
                  <Switch
                    checked={form.openToTrials}
                    onCheckedChange={(checked) => update("openToTrials", checked)}
                  />
                </label>
              </div>
            </div>

            <Field label="Player bio">
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                placeholder="Your playing style, strengths and experience."
              />
            </Field>

            <Field label="What you're looking for">
              <Textarea
                rows={3}
                value={form.lookingFor}
                onChange={(e) => update("lookingFor", e.target.value)}
                placeholder="e.g. A Step 5 club within 25 miles with midweek training."
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="subtle" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="volt" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save profile"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
