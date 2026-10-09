/**
 * Public vacancy share page /vacancies/{slug}: open and closed states, sign-in prompt to apply.
 */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, DetailRow, Panel, Pill } from "@/components/app/ui";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { AccountAction, PublicShell, UnavailablePanel, useViewer } from "@/components/public/PublicShell";
import { vacancyHeading } from "@/components/public/VacancyCard";
import { getPublicVacancy } from "@/lib/public-share.functions";
import { shareHead, shareImageUrl, sharePath } from "@/lib/share";

export const Route = createFileRoute("/vacancies/$slug")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const result = await getPublicVacancy({ data: { slug: params.slug } });
    if (!result || !result.club) throw notFound();
    return { vacancy: result.vacancy, club: result.club };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Vacancy unavailable — BallFindr" }, { name: "robots", content: "noindex" }] };
    }
    const { vacancy: v, club: c } = loaderData;
    const heading = vacancyHeading(v);
    const description = v.isOpen
      ? [`${c.name.trim()} is recruiting: ${heading}`, v.location ?? c.location, v.level ?? c.level].filter(Boolean).join(" | ")
      : `This vacancy at ${c.name} is no longer available.`;
    const head = shareHead({ title: `${heading} | ${c.name.trim()} — BallFindr`, description, path: sharePath("vacancy", params.slug), image: c.badgeUrl ? shareImageUrl("club", c.slug) : null });
    if (!v.isOpen) head.meta.push({ name: "robots", content: "noindex" });
    return head;
  },
  notFoundComponent: () => (
    <UnavailablePanel title="Vacancy unavailable" body="This vacancy is no longer available." />
  ),
  errorComponent: () => (
    <UnavailablePanel title="Something went wrong" body="We couldn't load this vacancy right now. Please try again shortly." />
  ),
  component: PublicVacancyPage,
});

function PublicVacancyPage() {
  const { vacancy: v, club: c } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const viewer = useViewer();
  const heading = vacancyHeading(v);
  const initials = (c.shortName || c.name.split(/\s+/).map((s) => s[0]).join("")).slice(0, 3).toUpperCase();

  return (
    <PublicShell>
      <Panel>
        <Link to="/clubs/$slug" params={{ slug: c.slug }} className="flex items-center gap-3">
          <Avatar initials={initials} imageUrl={c.badgeUrl} alt={`${c.name} badge`} className="size-12 object-contain text-xs" />
          <div className="min-w-0">
            <p className="font-display text-base uppercase">
              <AccountName verified={c.isVerified} owner={c.isOwner} founder={c.isFounderClub}>{c.name}</AccountName>
            </p>
            <p className="text-xs text-muted-foreground">{[c.level, c.league, c.location].filter(Boolean).join(" • ")}</p>
          </div>
        </Link>

        {v.isOpen ? (
          <>
            <h1 className="mt-5 font-display text-2xl text-primary uppercase sm:text-3xl">{heading}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {v.location || c.location ? <Pill><MapPin className="size-3" />{v.location || c.location}</Pill> : null}
              {v.trainingDays.length ? <Pill><CalendarDays className="size-3" />{v.trainingDays.join(" & ")}</Pill> : null}
              {v.trialsAvailable ? <Pill>Trials available</Pill> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <ShareButton kind="vacancy" slug={slug} title={`${heading} | ${c.name}`} />
              <AccountAction viewer={viewer} needs="player" label="I'm Interested" wrongTypeMessage="Only player accounts can register interest in a vacancy.">
                <Button asChild variant="volt" size="sm">
                  <Link to="/player/clubs/$clubId" params={{ clubId: c.id }} search={{ vacancy: v.id }}>I'm Interested</Link>
                </Button>
              </AccountAction>
            </div>
          </>
        ) : (
          <div className="mt-5">
            <h1 className="font-display text-2xl uppercase">This vacancy is no longer available.</h1>
            <p className="mt-2 text-sm text-muted-foreground">See the club's profile for any other open opportunities.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ShareButton kind="vacancy" slug={slug} title={`${heading} | ${c.name}`} />
              <Button asChild variant="volt" size="sm">
                <Link to="/clubs/$slug" params={{ slug: c.slug }}>View {c.name}</Link>
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {v.isOpen ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel>
            <p className="eyebrow">About this opportunity</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.description ?? "No further details added."}</p>
            {v.requirements ? (
              <p className="mt-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Requirements: </span>{v.requirements}</p>
            ) : null}
          </Panel>
          <Panel className="h-fit">
            <p className="eyebrow">Details</p>
            <div className="mt-3">
              <DetailRow label="Level" value={v.level ?? c.level ?? "—"} />
              <DetailRow label="Location" value={v.location ?? c.location ?? "—"} />
              <DetailRow label="Training" value={v.trainingDays.length ? v.trainingDays.join(" & ") : "—"} />
              <DetailRow label="Match day" value={v.matchDay ?? c.matchDay ?? "—"} />
            </div>
          </Panel>
        </div>
      ) : null}
    </PublicShell>
  );
}
