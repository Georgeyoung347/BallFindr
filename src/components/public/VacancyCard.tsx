/**
 * Vacancy summary card used on public club pages.
 */
import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { Pill } from "@/components/app/ui";
import { positionLabels } from "@/lib/club-vacancies";
import type { DbPosition } from "@/lib/player-profile";
import type { PublicVacancy } from "@/lib/public-share.functions";

export function vacancyHeading(v: PublicVacancy) {
  const positions = v.positions.map((p) => positionLabels[p as DbPosition] ?? p).join(" / ");
  return v.title || positions || "Vacancy";
}

export function PublicVacancyCard({ v }: { v: PublicVacancy }) {
  return (
    <Link
      to="/vacancies/$slug"
      params={{ slug: v.slug }}
      className="block rounded-xl border border-primary/25 bg-primary/[0.06] p-3 transition-colors hover:border-primary/50"
    >
      <p className="font-display text-sm font-extrabold tracking-wide text-primary uppercase">{vacancyHeading(v)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {v.location ? <Pill><MapPin className="size-3" />{v.location}</Pill> : null}
        {v.trainingDays.length ? <Pill><CalendarDays className="size-3" />{v.trainingDays.join(" & ")}</Pill> : null}
        {v.trialsAvailable ? <Pill>Trials available</Pill> : null}
      </div>
    </Link>
  );
}
