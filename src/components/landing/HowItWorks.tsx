/**
 * Homepage: step-by-step 'How it works' section with player/club toggle.
 */
import { useState } from "react";
import { Shield, UserRound } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import type { AccountType } from "@/lib/domain";

const steps: Record<AccountType, { number: string; title: string; copy: string }[]> = {
  player: [
    {
      number: "01",
      title: "Create your profile",
      copy: "Build your football profile with your position, location, experience and availability.",
    },
    {
      number: "02",
      title: "Discover opportunities",
      copy: "Find clubs looking for players like you.",
    },
    {
      number: "03",
      title: "Make your move",
      copy: "Apply and connect directly with clubs.",
    },
  ],
  club: [
    { number: "01", title: "Create your club", copy: "Build your club profile." },
    {
      number: "02",
      title: "Post what you need",
      copy: "Tell players exactly who you're looking for.",
    },
    {
      number: "03",
      title: "Find your player",
      copy: "Review relevant candidates and start conversations.",
    },
  ],
};

export function HowItWorks() {
  const [side, setSide] = useState<AccountType>("player");
  const active = steps[side];

  return (
    <Section id="how-it-works">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <SectionHeading
            eyebrow="Two sides, one platform"
            title="How BallFindr works"
            description="Whichever side of the game you're on, it takes three steps."
          />
        </Reveal>

        <Reveal delay={80}>
          <div
            role="tablist"
            aria-label="Choose a perspective"
            className="inline-flex rounded-2xl border border-border bg-elevated/60 p-1"
          >
            {(["player", "club"] as AccountType[]).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={side === key}
                onClick={() => setSide(key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-display text-sm font-bold tracking-tight uppercase transition-all ${
                  side === key
                    ? "bg-[image:var(--gradient-volt)] text-primary-foreground shadow-[var(--shadow-volt)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {key === "player" ? (
                  <UserRound className="size-4" />
                ) : (
                  <Shield className="size-4" />
                )}
                For {key}s
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {active.map((step, i) => (
          <div
            key={`${side}-${step.number}`}
            className="surface-card rise-in relative overflow-hidden rounded-2xl p-6"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <span className="font-display text-5xl font-extrabold text-primary/25">
              {step.number}
            </span>
            <h3 className="mt-3 font-display text-lg uppercase">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
            <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-primary),transparent)] opacity-40" />
          </div>
        ))}
      </div>
    </Section>
  );
}
