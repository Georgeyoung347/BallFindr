/**
 * Layout for auth/onboarding screens (sign in, join, welcome setup).
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

/** Shared frame for signup / onboarding flows. */
export function OnboardingShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-20 sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <p className="eyebrow mt-8">{eyebrow}</p>
        <h1 className="mt-3 text-4xl uppercase sm:text-5xl">{title}</h1>
        <p className="mt-4 text-muted-foreground">{description}</p>
        <div className="mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function ComingSoonNote({ steps }: { steps: string[] }) {
  return (
    <div className="surface-card rounded-2xl p-6">
      <p className="eyebrow">Next up</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-elevated font-display text-[11px] font-extrabold text-primary">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-muted-foreground">
        Sign-up opens when the first release goes live.
      </p>
    </div>
  );
}
