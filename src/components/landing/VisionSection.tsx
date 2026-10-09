/**
 * Homepage: vision/mission section.
 */
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";

const categories = [
  { emoji: "⚽", label: "Clubs", live: true },
  { emoji: "👤", label: "Players", live: true },
  { emoji: "🏋️", label: "Training" },
  { emoji: "🎥", label: "Video" },
  { emoji: "🧠", label: "Coaching" },
  { emoji: "🥗", label: "Performance" },
];

export function VisionSection() {
  return (
    <Section id="vision">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="The vision"
          title="More than finding a club."
          description="BallFindr is building a connected football ecosystem — from finding your next club to improving your game."
        />
      </Reveal>

      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat, i) => (
          <Reveal key={cat.label} delay={i * 60}>
            <div className="surface-card flex h-full flex-col items-center gap-2 rounded-2xl px-3 py-6 text-center transition-transform hover:-translate-y-1">
              <span className="text-2xl" aria-hidden="true">
                {cat.emoji}
              </span>
              <span className="font-display text-sm font-extrabold uppercase">{cat.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase ${
                  cat.live
                    ? "bg-primary/10 text-primary"
                    : "bg-elevated text-muted-foreground"
                }`}
              >
                {cat.live ? "Phase 1" : "Planned"}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
