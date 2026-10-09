/**
 * Homepage: closing call-to-action section.
 */
import { Link } from "@tanstack/react-router";
import { Shield, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";

export function FinalCta() {
  return (
    <Section id="get-started">
      <Reveal>
        <div className="surface-card grid-lines relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 md:py-20">
          <div
            className="pointer-events-none absolute -bottom-32 left-1/2 size-[420px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
            style={{ background: "var(--gradient-volt)" }}
          />
          <div className="relative">
            <p className="eyebrow">Get started</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl leading-[1.05] uppercase sm:text-5xl">
              Ready to find your next move?
            </h2>
            <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="volt" size="xl" className="w-full sm:w-auto">
                <Link to="/join/player">
                  <UserRound className="size-4" /> I'm a Player
                </Link>
              </Button>
              <Button asChild variant="voltOutline" size="xl" className="w-full sm:w-auto">
                <Link to="/join/club">
                  <Shield className="size-4" /> I'm a Club
                </Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Free while we build the first release.
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
