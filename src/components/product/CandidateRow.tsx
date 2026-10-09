/**
 * Marketing-only demo component (homepage preview): a candidate row. Uses lib/domain demo types, not live data.
 */
import type { PlayerProfile } from "@/lib/domain";

export function CandidateRow({
  player,
  score,
  distanceMiles,
}: {
  player: PlayerProfile;
  score: number;
  distanceMiles: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated/60 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-background font-display text-[11px] font-extrabold text-primary">
        {player.position}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{player.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {player.level} • {distanceMiles} miles
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 font-display text-xs font-extrabold text-primary tabular-nums">
        {score}%
      </span>
    </div>
  );
}
