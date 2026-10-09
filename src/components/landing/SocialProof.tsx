/**
 * Homepage: testimonials/social proof section.
 */
import { Quote } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";

/**
 * Placeholder testimonial slots. No fictional people or clubs are presented
 * as real customers — replace `testimonialSlots` with genuine quotes later.
 */
const testimonialSlots = [
  { audience: "Player testimonial", note: "Reserved for a real player quote." },
  { audience: "Club testimonial", note: "Reserved for a real club quote." },
  { audience: "Manager testimonial", note: "Reserved for a real manager quote." },
];

export function SocialProof() {
  return (
    <Section id="community">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="Community"
          title="Built for the people who actually play the game."
          description="BallFindr is being built with non-league players, managers and club staff. Real stories from the first clubs and players will appear here."
        />
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {testimonialSlots.map((slot, i) => (
          <Reveal key={slot.audience} delay={i * 90}>
            <div className="h-full rounded-2xl border border-dashed border-border bg-elevated/30 p-6">
              <Quote className="size-5 text-primary/60" />
              <p className="mt-4 text-sm text-muted-foreground italic">{slot.note}</p>
              <p className="mt-6 text-[10px] tracking-[0.16em] text-muted-foreground/70 uppercase">
                {slot.audience} — coming soon
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
