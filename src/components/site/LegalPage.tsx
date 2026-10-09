/**
 * Layout wrapper for legal pages (terms, privacy, cookies).
 */
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

/**
 * Shared frame for BallFindr's public legal pages (privacy, terms, cookies).
 * Plain reading layout in the existing BallFindr style; no new dependencies.
 */
export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-3xl uppercase break-words sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <p className="mt-4 text-muted-foreground">{intro}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg uppercase tracking-wide break-words sm:text-xl">
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5">
      {items.map((item) => (
        <li key={item} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LegalEmail() {
  return (
    <a href="mailto:ballfindr@gmail.com" className="font-semibold break-all text-primary">
      ballfindr@gmail.com
    </a>
  );
}
