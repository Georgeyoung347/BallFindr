/**
 * Small stat summary (views, applications, etc.) shown on profile/dashboard pages.
 */
import type { ComponentType } from "react";

export interface ActivityMetric {
  label: string;
  value: number;
  icon?: ComponentType<{ className?: string }>;
}

/** Compact activity counters (applications, interest, trials, shortlists). */
export function ActivitySummary({ metrics }: { metrics: ActivityMetric[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {metrics.map((m) => (
        <li key={m.label} className="rounded-xl border border-border bg-elevated/50 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {m.label}
            </p>
            {m.icon ? <m.icon className="size-3.5 text-primary" /> : null}
          </div>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{m.value}</p>
        </li>
      ))}
    </ul>
  );
}
