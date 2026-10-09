/**
 * Create/edit vacancy form (positions, level, details, optional contact). Used by club.vacancies.new and the edit route.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel, FilterChip, Panel } from "@/components/app/ui";
import { trainingDayOptions, type TrainingDay } from "@/data/app-config";
import { dbPositions, usePlayerLevels, type DbPosition } from "@/lib/player-profile";
import {
  matchDayOptions,
  positionLabels,
  vacancyStatusLabels,
  vacancyStatuses,
  type VacancyForm as VacancyFormValues,
  isAllPositions,
  vacancyTitleFor,
} from "@/lib/club-vacancies";

export function VacancyFormFields({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
  showStatus = false,
}: {
  initial: VacancyFormValues;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (form: VacancyFormValues) => void;
  onCancel: React.ReactNode;
  showStatus?: boolean;
}) {
  const { data: levels = [] } = usePlayerLevels();
  const [form, setForm] = useState<VacancyFormValues>(initial);

  const set = <K extends keyof VacancyFormValues>(key: K, value: VacancyFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const togglePosition = (p: DbPosition) =>
    set(
      "positions",
      form.positions.includes(p) ? form.positions.filter((x) => x !== p) : [...form.positions, p],
    );

  const toggleDay = (d: TrainingDay) =>
    set(
      "trainingDays",
      form.trainingDays.includes(d)
        ? form.trainingDays.filter((x) => x !== d)
        : [...form.trainingDays, d],
    );

  const vacancyDescriptionForPosition = (p: DbPosition): string => {
    const phrase =
      {
        ST: "striker",
        LW: "left winger",
        RW: "right winger",
        CAM: "attacking midfielder",
        CM: "central midfielder",
        CDM: "defensive midfielder",
        LB: "left-back",
        RB: "right-back",
        CB: "centre-back",
        GK: "goalkeeper",
      }[p] ?? positionLabels[p]?.toLowerCase() ?? p.toLowerCase();
    return `Looking for an experienced ${phrase} to join the team.`;
  };

  const autoDescriptions = dbPositions.map(vacancyDescriptionForPosition);

  useEffect(() => {
    const primary = form.positions[0];
    if (!primary) return;
    setForm((f) => {
      const next = vacancyDescriptionForPosition(primary);
      if (f.description === "" || autoDescriptions.includes(f.description)) {
        return { ...f, description: next };
      }
      return f;
    });
  }, [form.positions]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <Panel className="space-y-6">
        <div>
          <FieldLabel>Positions</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            <FilterChip
              active={isAllPositions(form.positions)}
              onClick={() =>
                set("positions", isAllPositions(form.positions) ? [] : [...dbPositions])
              }
            >
              All Positions
            </FilterChip>
            {dbPositions.map((p) => (
              <FilterChip
                key={p}
                active={form.positions.includes(p)}
                onClick={() => togglePosition(p)}
              >
                {p}
              </FilterChip>
            ))}
          </div>
          {form.positions.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {form.positions.map((p) => positionLabels[p]).join(", ")}
            </p>
          ) : null}
        </div>

        <label className="block">
          <FieldLabel>Title</FieldLabel>
          <Input
            value={vacancyTitleFor(form.positions) ?? ""}
            readOnly
            aria-readonly
            placeholder="Select positions to create the title"
            className="mt-2 h-11 rounded-xl border-border bg-elevated/60"
          />
        </label>

        <div>
          <FieldLabel>Level</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {levels.map((l) => (
              <FilterChip
                key={l.id}
                active={form.levelId === l.id}
                onClick={() => set("levelId", form.levelId === l.id ? null : l.id)}
              >
                {l.name}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Location</FieldLabel>
            <Input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              className="mt-2 h-11 rounded-xl border-border bg-elevated/60"
            />
          </label>
          <label className="block">
            <FieldLabel>Expires on</FieldLabel>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              className="mt-2 h-11 rounded-xl border-border bg-elevated/60"
            />
          </label>
        </div>

        <div>
          <FieldLabel>Training days</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {trainingDayOptions.map((d) => (
              <FilterChip key={d} active={form.trainingDays.includes(d)} onClick={() => toggleDay(d)}>
                {d}
              </FilterChip>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Match day</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {matchDayOptions.map((d) => (
              <FilterChip
                key={d}
                active={form.matchDay === d}
                onClick={() => set("matchDay", form.matchDay === d ? "" : d)}
              >
                {d}
              </FilterChip>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Trials</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            <FilterChip
              active={form.trialsAvailable}
              onClick={() => set("trialsAvailable", !form.trialsAvailable)}
            >
              Trials available
            </FilterChip>
          </div>
        </div>

        {showStatus ? (
          <div>
            <FieldLabel>Status</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {vacancyStatuses.map((s) => (
                <FilterChip key={s} active={form.status === s} onClick={() => set("status", s)}>
                  {vacancyStatusLabels[s]}
                </FilterChip>
              ))}
            </div>
          </div>
        ) : null}

        <label className="block">
          <FieldLabel>Description</FieldLabel>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={5}
            className="mt-2 rounded-xl border-border bg-elevated/60"
          />
        </label>

        <label className="block">
          <FieldLabel>Requirements</FieldLabel>
          <Textarea
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
            rows={3}
            className="mt-2 rounded-xl border-border bg-elevated/60"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="volt" disabled={pending || form.positions.length === 0}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          {onCancel}
        </div>
        {form.positions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Pick at least one position to continue.</p>
        ) : null}
      </Panel>
    </form>
  );
}
