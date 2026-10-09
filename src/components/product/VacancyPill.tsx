/**
 * Marketing-only demo vacancy pill for the homepage preview.
 */
import type { Vacancy } from "@/lib/domain";

export function VacancyPill({ vacancy }: { vacancy: Vacancy }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/70 px-3 py-2.5 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 font-display text-[11px] font-extrabold text-primary">
          {vacancy.position}
        </span>
        <span className="text-sm font-medium">{vacancy.positionLabel}</span>
      </div>
      <span className="text-xs text-muted-foreground">{vacancy.level}</span>
    </div>
  );
}
