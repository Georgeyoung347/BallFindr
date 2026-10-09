/**
 * Reusable titled card section used across profile pages.
 */
import type { ReactNode } from "react";
import { Panel } from "@/components/app/ui";
import { cn } from "@/lib/utils";

/**
 * Standard wrapper for every profile section: eyebrow heading, optional
 * action, and a built-in empty state for when the record has no rows yet.
 */
export function ProfileSection({
  title,
  hint,
  action,
  isEmpty = false,
  emptyLabel = "No records yet",
  emptyHint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  emptyHint?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Panel {...(className ? { className } : {})}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{title}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("mt-3")}>
        {isEmpty ? (
          <div className="rounded-xl border border-dashed border-border bg-elevated/30 px-4 py-8 text-center">
            <p className="text-sm font-semibold">{emptyLabel}</p>
            {emptyHint ? (
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{emptyHint}</p>
            ) : null}
          </div>
        ) : (
          children
        )}
      </div>
    </Panel>
  );
}
