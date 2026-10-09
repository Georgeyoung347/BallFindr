/**
 * Small shared UI building blocks for the signed-in app (page headers, empty states, stat tiles, etc.).
 */
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  availabilityLabels,
  stageLabels,
  type ApplicationStage,
  type Availability,
} from "@/data/app-config";
import {
  applicationStageLabels,
  applicationStageTone,
  type ApplicationStage as DbApplicationStage,
} from "@/lib/applications";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl leading-tight uppercase sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  children,
  className,
  as: As = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
  id?: string;
}) {
  return <As id={id} className={cn("surface-card rounded-2xl p-4 sm:p-5", className)}>{children}</As>;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        {Icon ? <Icon className="size-4 text-primary" /> : null}
      </div>
      <p
        className={cn(
          "mt-2",
          typeof value === "number"
            ? "font-display text-3xl font-extrabold tabular-nums"
            : "text-base font-semibold leading-snug",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Panel>
  );
}

export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "success" | "outline";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "muted" && "border border-border bg-elevated text-muted-foreground",
        tone === "outline" && "border border-border text-muted-foreground",
        tone === "primary" && "border border-primary/30 bg-primary/10 text-primary",
        tone === "success" && "border border-[color:var(--success)]/30 text-[color:var(--success)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  imageUrl,
  alt = "Profile image",
  className,
}: {
  initials: string;
  imageUrl?: string | null | undefined;
  alt?: string;
  className?: string | undefined;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        className={cn("size-11 shrink-0 rounded-xl border border-border object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl bg-elevated font-display text-sm font-extrabold text-primary",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function ProfileCover({
  imageUrl,
  alt,
  label,
  fit = "cover",
  className,
}: {
  imageUrl?: string | null | undefined;
  alt: string;
  label: string;
  fit?: "cover" | "contain";
  className?: string | undefined;
}) {
  if (imageUrl) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-elevated/40",
          className,
        )}
      >
        <img
          src={imageUrl}
          alt={alt}
          className={cn(
            "object-center",
            fit === "contain"
              ? "max-h-full max-w-full object-contain"
              : "h-full w-full object-cover",
          )}
        />
      </div>
    );
  }
  return <PhotoPlaceholder label={label} {...(className ? { className } : {})} />;
}

export function MatchPill({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-display text-xs font-extrabold text-primary tabular-nums",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" />
      {score}% match
    </span>
  );
}

export function AvailabilityTag({ availability }: { availability: Availability }) {
  const positive = availability === "immediately" || availability === "actively_looking";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn("size-2 rounded-full", positive ? "bg-[color:var(--success)]" : "bg-muted-foreground")}
      />
      {availabilityLabels[availability]}
    </span>
  );
}

const stageTone: Record<ApplicationStage, string> = {
  applied: "border-border bg-elevated text-muted-foreground",
  viewed: "border-border bg-elevated text-foreground",
  shortlisted: "border-primary/30 bg-primary/10 text-primary",
  trial: "border-primary/40 bg-primary/15 text-primary",
  accepted: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** Badge for a real database application stage (applications.stage). */
export function ApplicationStageBadge({
  stage,
  label,
}: {
  stage: DbApplicationStage;
  label?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        applicationStageTone[stage],
      )}
    >
      {label ?? applicationStageLabels[stage]}
    </span>
  );
}

export function StageBadge({ stage, label }: { stage: ApplicationStage; label?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        stageTone[stage],
      )}
    >
      {label ?? stageLabels[stage]}
    </span>
  );
}

export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-elevated/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Panel className="py-12 text-center">
      <p className="font-display text-lg uppercase">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
    </Panel>
  );
}

export function PhotoPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "grid-lines grid place-items-center rounded-xl border border-border bg-elevated/40 text-[11px] tracking-[0.14em] text-muted-foreground uppercase",
        className,
      )}
    >
      {label}
    </div>
  );
}
