/**
 * Homepage: section describing benefits for clubs.
 */
import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { CandidateRow } from "@/components/product/CandidateRow";
import { VacancyPill } from "@/components/product/VacancyPill";
import { demoCandidates, demoClub, demoVacancies } from "@/data/demo";

export function ForClubs() {
  return (
    <Section id="for-clubs">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
        <Reveal className="lg:order-2">
          <SectionHeading
            eyebrow="For clubs"
            title="Recruit without asking around."
            description="Post exactly who you need and see available players who fit your level, position and area."
          />
          <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
            <li>• Post vacancies by position, level and location.</li>
            <li>• Review ranked candidates who are actually available.</li>
            <li>• Shortlist and manage applications in one place.</li>
          </ul>
          <Button asChild variant="volt" size="xl" className="mt-8 w-full sm:w-auto">
            <Link to="/join/club">Create Club Profile</Link>
          </Button>
        </Reveal>

        <Reveal delay={120} className="lg:order-1">
          <ClubDashboardPreview />
        </Reveal>
      </div>
    </Section>
  );
}

function ClubDashboardPreview() {
  return (
    <div className="surface-card rounded-3xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-xl bg-elevated text-primary">
          <Shield className="size-5" />
        </div>
        <div>
          <p className="font-display text-lg font-extrabold uppercase">{demoClub.name}</p>
          <p className="text-xs text-muted-foreground">
            {demoClub.level} • {demoClub.location}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="eyebrow">Currently recruiting</p>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-primary uppercase">
          {demoVacancies.length} open
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {demoVacancies.map((vacancy) => (
          <VacancyPill key={vacancy.id} vacancy={vacancy} />
        ))}
      </div>

      <p className="eyebrow mt-6">Suggested candidates</p>
      <div className="mt-3 space-y-2">
        {demoCandidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            player={candidate}
            score={candidate.score}
            distanceMiles={candidate.distanceMiles}
          />
        ))}
      </div>
    </div>
  );
}
