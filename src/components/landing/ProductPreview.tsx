/**
 * Homepage: illustrative product preview using demo cards (components/product, data/demo).
 */
import { ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { PlayerCard } from "@/components/product/PlayerCard";
import { ClubCard } from "@/components/product/ClubCard";
import { MatchScore } from "@/components/product/MatchScore";
import { demoClub, demoMatch, demoPlayer } from "@/data/demo";

/**
 * Visual demonstration of a player↔club match.
 * Data comes from `@/data/demo` and can be swapped for real records later.
 */
export function ProductPreview() {
  return (
    <Section id="preview" className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-64 max-w-3xl rounded-full opacity-15 blur-[130px]"
        style={{ background: "var(--gradient-volt)" }}
      />
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="Inside BallFindr"
          title="Real matches. Not group chats."
          description="Every profile, vacancy and match on BallFindr is structured — so the right player and the right club actually find each other."
        />
      </Reveal>

      <div className="mt-12 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Reveal>
          <PlayerCard player={demoPlayer} />
        </Reveal>

        <Reveal delay={120}>
          <div className="flex flex-row items-center justify-center gap-3 lg:flex-col">
            <div className="h-px w-10 bg-border lg:h-10 lg:w-px" />
            <MatchScore score={demoMatch.score} size={108} />
            <div className="h-px w-10 bg-border lg:h-10 lg:w-px" />
            <ArrowRight className="size-4 text-primary lg:rotate-90" />
          </div>
        </Reveal>

        <Reveal delay={220}>
          <ClubCard
            club={demoClub}
            distanceMiles={demoMatch.distanceMiles}
            lookingFor="⚽ Striker"
          />
        </Reveal>
      </div>
    </Section>
  );
}
