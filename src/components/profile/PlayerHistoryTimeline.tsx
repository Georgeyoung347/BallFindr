/**
 * Displays a player's club history timeline with owner edit controls.
 */
import { ArrowDown, ArrowUp, MoveRight, Pencil } from "lucide-react";
import { Pill } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import type { PlayerHistoryEntry } from "@/data/profile-model";

const transitionMeta = {
  promotion: { label: "Promotion", icon: ArrowUp, tone: "text-[color:var(--success)]" },
  relegation: { label: "Relegation", icon: ArrowDown, tone: "text-destructive" },
  move: { label: "Move", icon: MoveRight, tone: "text-muted-foreground" },
  stayed: { label: "Stayed", icon: MoveRight, tone: "text-muted-foreground" },
} as const;

function StatCell({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg bg-elevated/70 px-3 py-2 text-center">
      <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-display text-base font-extrabold tabular-nums">
        {value ?? "—"}
      </p>
    </div>
  );
}

/** Career progression, current spell first then newest first. */
export function PlayerHistoryTimeline({
  entries,
  onEdit,
}: {
  entries: PlayerHistoryEntry[];
  /** When provided (owner view), each entry shows an Edit button. */
  onEdit?: (id: string) => void;
}) {
  return (
    <ol className="relative space-y-3 border-l border-border/70 pl-5">
      {entries.map((e) => {
        const meta = e.transition ? transitionMeta[e.transition] : null;
        const Icon = meta?.icon;
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute top-5 -left-[27px] size-2.5 rounded-full ${
                e.isCurrent ? "bg-primary ring-4 ring-primary/20" : "bg-primary"
              }`}
            />
            <div className="rounded-xl border border-border bg-elevated/50 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm tracking-wide uppercase">{e.season}</span>
                <span className="text-sm font-semibold">{e.club}</span>
                {e.isCurrent ? <Pill tone="success">Current club</Pill> : null}
                <div className="ml-auto flex items-center gap-2">
                  <Pill tone="primary">{e.level}</Pill>
                  {onEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Edit ${e.club} ${e.season}`}
                      onClick={() => onEdit(e.id)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[e.league, e.position].filter(Boolean).join(" • ") || "League and position to be added"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatCell label="Apps" value={e.appearances} />
                {e.position === "GK" ? (
                  <>
                    <StatCell label="Clean Sheets" value={e.cleanSheets} />
                    <StatCell label="G/A" value={e.goalsAgainst} />
                  </>
                ) : (
                  <>
                    <StatCell label="Goals" value={e.goals} />
                    <StatCell label="Assists" value={e.assists} />
                  </>
                )}
              </div>
              {e.notes ? (
                <p className="mt-2 text-xs text-muted-foreground">{e.notes}</p>
              ) : null}
              {meta && Icon ? (
                <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${meta.tone}`}>
                  <Icon className="size-3.5" /> {meta.label}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
