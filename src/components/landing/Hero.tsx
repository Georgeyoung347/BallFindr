/**
 * Homepage: top hero section with headline and Join/Sign in buttons.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, Shield, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchScore } from "@/components/product/MatchScore";
import { demoClub, demoMatch, demoPlayer } from "@/data/demo";
import { availabilityLabel } from "@/lib/domain";
import heroPitch from "@/assets/hero-pitch.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <img
        src={heroPitch}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1280}
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-40"
      />
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--hero-overlay)]" />
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 size-[520px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{ background: "var(--gradient-volt)" }}
      />

      <div className="relative mx-auto grid grid-cols-1 w-full max-w-6xl gap-14 px-5 pt-16 pb-24 sm:px-8 md:pt-24 md:pb-32 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="rise-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Built for Non-league, Semi-pro &amp; Sunday league football
          </span>

          <h1 className="mt-6 font-display text-[2.6rem] leading-[0.95] uppercase sm:text-6xl lg:text-7xl">
            STOP CHASING CLUBS.
            <span className="mt-2 block text-volt-gradient">Let CLUBS FIND YOU.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            BallFindr connects players looking for their next club with clubs looking for
            their next player. Football recruitment, made simple.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button asChild variant="volt" size="xl" className="w-full sm:w-auto sm:self-start">
              <Link to="/auth" search={{ type: "player", mode: "signup" }}>
                JOIN NOW <ArrowRight className="size-4" />
              </Link>
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="voltOutline" size="xl" className="w-full sm:w-auto">
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
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>

        <div className="rise-in [animation-delay:180ms]">
          <HeroMatchPanel />
        </div>
      </div>
    </section>
  );
}

function HeroMatchPanel() {
  return (
    <div className="surface-card relative mx-auto w-full max-w-md rounded-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Live match</p>
        <span className="rounded-full border border-border bg-elevated px-2.5 py-1 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Preview
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-elevated/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-background font-display text-sm font-extrabold text-primary">
            JW
          </div>
          <div>
            <p className="font-display text-base font-extrabold uppercase">{demoPlayer.name}</p>
            <p className="text-xs text-muted-foreground">
              {demoPlayer.position} • {demoPlayer.level} • {demoPlayer.location}
            </p>
          </div>
        </div>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {availabilityLabel[demoPlayer.availability]}
        </span>
      </div>

      <div className="my-4 flex items-center gap-4">
        <MatchScore score={demoMatch.score} size={88} />
        <div className="h-px flex-1 bg-[linear-gradient(90deg,var(--color-border),transparent)]" />
        <ArrowRight className="size-4 text-primary" />
      </div>

      <div className="rounded-2xl border border-border bg-elevated/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-background text-primary">
            <Shield className="size-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold uppercase">{demoClub.name}</p>
            <p className="text-xs text-muted-foreground">
              {demoClub.level} • {demoMatch.distanceMiles} miles away
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Looking for:</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary">
            ⚽ Striker
          </span>
        </div>
      </div>
    </div>
  );
}
