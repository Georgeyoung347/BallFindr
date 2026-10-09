/**
 * Displays a club's season history (league, position, W/D/L) with owner edit controls.
 */
import { ArrowDown, ArrowUp, Pencil, Trophy } from "lucide-react";
import { Pill } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import type { ClubHistoryEntry } from "@/data/profile-model";

const outcomeMeta = {
  promoted: { label: "Promoted", icon: ArrowUp, className: "border-[color:var(--success)]/40 text-[color:var(--success)]" },
  relegated: { label: "Relegated", icon: ArrowDown, className: "border-destructive/40 text-destructive" },
  champions: { label: "League champions", icon: Trophy, className: "border-primary/40 text-primary" },
} as const;

/** Season-by-season league record, newest first. */
export function ClubHistoryTimeline({
  entries,
  onEdit,
}: {
  entries: ClubHistoryEntry[];
  /** When provided (owner view), each season shows an Edit button. */
  onEdit?: (id: string) => void;
}) {
  return (
    <ol className="relative space-y-3 border-l border-border/70 pl-5">
      {entries.map((e) => {
        const meta =
          e.outcome && e.outcome !== "none" ? outcomeMeta[e.outcome] : null;
        const Icon = meta?.icon;
        return (
          <li key={e.id} className="relative">
            <span className="absolute top-5 -left-[27px] size-2.5 rounded-full bg-primary" />
            <div className="rounded-xl border border-border bg-elevated/50 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm tracking-wide uppercase">{e.season}</span>
                <Pill tone="primary">{e.level}</Pill>
                {meta && Icon ? (
                  <span
                    className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                  >
                    <Icon className="size-3.5" /> {meta.label}
                  </span>
                ) : e.finalPosition ? (
                  <Pill className="ml-auto">Finished {e.finalPosition}</Pill>
                ) : null}
                {onEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7 shrink-0"
                    aria-label={`Edit ${e.season}`}
                    onClick={() => onEdit(e.id)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{e.league}</p>
              {e.wins != null || e.draws != null || e.losses != null ? (
                <p className="mt-1.5 flex gap-4 text-sm font-semibold tabular-nums">
                  <span><span className="text-muted-foreground">W</span> {e.wins ?? 0}</span>
                  <span><span className="text-muted-foreground">D</span> {e.draws ?? 0}</span>
                  <span><span className="text-muted-foreground">L</span> {e.losses ?? 0}</span>
                </p>
              ) : null}
              {e.cupAchievement ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary">
                  <Trophy className="size-3.5" /> {e.cupAchievement}
                </p>
              ) : null}
              {e.notes ? <p className="mt-2 text-xs text-muted-foreground">{e.notes}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
