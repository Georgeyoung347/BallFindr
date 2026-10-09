/**
 * Reusable grid of label/value facts on profile pages.
 */
import type { ReactNode } from "react";

export interface ProfileFact {
  label: string;
  value: ReactNode;
}

/** Scannable key/value grid used for core information across both profiles. */
export function ProfileFactGrid({ facts }: { facts: ProfileFact[] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {facts.map((f) => (
        <div
          key={f.label}
          className="min-w-0 rounded-xl border border-border bg-elevated/50 px-3 py-2.5"
        >
          <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {f.label}
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold">{f.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
