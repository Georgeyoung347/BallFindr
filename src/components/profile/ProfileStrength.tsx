/**
 * Profile completion card (dashboard + profile). Percentage computed by lib/profile-completion.
 */
import type { ReactNode } from "react";
import { Panel } from "@/components/app/ui";

/**
 * The profile completion indicator from the Profile page, reused verbatim on
 * the dashboards. Same calculation input (`strength`), same styling, same
 * wording — a single shared component so the two never diverge.
 * `action` is optional (dashboards pass a "Complete profile" button; the
 * Profile pages render this card without one, exactly as before).
 */
export function ProfileStrength({
  strength,
  hint = "Complete your details, playing history and achievements to reach 100%.",
  action,
}: {
  strength: number;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Panel>
      <p className="eyebrow">Profile strength</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-volt)]"
              style={{ width: `${strength}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        </div>
        <span className="font-display text-3xl font-extrabold text-primary tabular-nums">
          {strength}%
        </span>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </Panel>
  );
}
