/**
 * Displays a profile's achievements list with optional reorder/edit controls for the owner.
 */
import { Award, Medal, Star, Trophy, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { achievementKindLabels, type Achievement, type AchievementKind } from "@/data/profile-model";

const icons: Record<AchievementKind, ComponentType<{ className?: string }>> = {
  award: Award,
  league_title: Trophy,
  cup: Medal,
  individual: Star,
  promotion: ArrowUp,
  relegation: ArrowDown,
  other: Star,
};

export function AchievementList({
  achievements,
  onEdit,
}: {
  achievements: Achievement[];
  /** When provided (owner view), each achievement shows an Edit button. */
  onEdit?: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {achievements.map((a) => {
        const Icon = icons[a.kind] ?? Star;
        return (
          <li
            key={a.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-elevated/50 p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[achievementKindLabels[a.kind], a.season, a.club].filter(Boolean).join(" • ")}
              </p>
              {a.detail ? (
                <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
              ) : null}
            </div>
            {onEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Edit ${a.title}`}
                onClick={() => onEdit(a.id)}
              >
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
