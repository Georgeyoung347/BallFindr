/**
 * Homepage: section describing benefits for players.
 */
import { Link } from "@tanstack/react-router";
import { Bell, FileText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { demoClubRecommendations, demoPlayer } from "@/data/demo";
import { availabilityLabel } from "@/lib/domain";

export function ForPlayers() {
  return (
    <Section id="for-players">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <SectionHeading
            eyebrow="For players"
            title="Your next opportunity could be closer than you think."
            description="Build your football profile once and discover clubs looking for players like you."
          />
          <ul className="mt-8 space-y-4">
            {[
              { icon: FileText, text: "One profile: position, level, location, experience." },
              { icon: MapPin, text: "See clubs recruiting near you, ranked by fit." },
              { icon: Bell, text: "Track your applications from applied to signed." },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-elevated text-primary">
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm text-muted-foreground">{item.text}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="volt" size="xl" className="mt-8 w-full sm:w-auto">
            <Link to="/join/player">Create Player Profile</Link>
          </Button>
        </Reveal>

        <Reveal delay={120}>
          <PlayerDashboardPreview />
        </Reveal>
      </div>
    </Section>
  );
}

function PlayerDashboardPreview() {
  return (
    <div className="surface-card rounded-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Player dashboard</p>
        <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-success uppercase">
          {availabilityLabel[demoPlayer.availability]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Position", value: demoPlayer.position },
          { label: "Level", value: demoPlayer.level },
          { label: "Location", value: demoPlayer.location },
          { label: "Apps", value: "3" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-elevated/70 px-3 py-2.5">
            <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {item.label}
            </p>
            <p className="mt-1 truncate font-display text-sm font-extrabold">{item.value}</p>
          </div>
        ))}
      </div>

      <p className="eyebrow mt-6">Clubs looking for you</p>
      <div className="mt-3 space-y-2">
        {demoClubRecommendations.map((rec) => (
          <div
            key={rec.club.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-elevated/60 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{rec.club.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {rec.club.level} • {rec.distanceMiles} miles • {rec.position}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 font-display text-xs font-extrabold text-primary tabular-nums">
              {rec.score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
