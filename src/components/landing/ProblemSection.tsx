/**
 * Homepage: section explaining the recruitment problem BallFindr solves.
 */
import { Shield, Sparkles, UserRound } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";

const cards = [
  {
    icon: UserRound,
    title: "Players",
    copy: "Find clubs that are actually looking.",
  },
  {
    icon: Shield,
    title: "Clubs",
    copy: "Find players who are actually available.",
  },
  {
    icon: Sparkles,
    title: "BallFindr",
    copy: "Bring both sides together.",
    highlight: true,
  },
];

export function ProblemSection() {
  return (
    <Section id="problem">
      <Reveal>
        <SectionHeading
          eyebrow="The problem"
          title="Stop searching. Start finding."
          description="Finding a club or a player shouldn't depend on being in the right WhatsApp group or knowing the right person. Recruitment in non-league football is scattered across group chats, Facebook posts and word of mouth — so the right player and the right club rarely meet."
        />
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 90}>
            <div
              className={`surface-card group h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 ${
                card.highlight ? "border-primary/30" : ""
              }`}
            >
              <div
                className={`grid size-11 place-items-center rounded-xl ${
                  card.highlight
                    ? "bg-[image:var(--gradient-volt)] text-primary-foreground"
                    : "bg-elevated text-primary"
                }`}
              >
                <card.icon className="size-5" />
              </div>
              <h3 className="mt-5 font-display text-xl uppercase">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.copy}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
