/**
 * Public club share page /clubs/{slug}: safe fields only via public-share server functions; dynamic social metadata.
 */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, DetailRow, Panel, Pill } from "@/components/app/ui";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { AccountAction, PublicShell, UnavailablePanel, useViewer } from "@/components/public/PublicShell";
import { PublicVacancyCard } from "@/components/public/VacancyCard";
import { getPublicClub, type PublicClub } from "@/lib/public-share.functions";
import { shareHead, shareImageUrl, sharePath } from "@/lib/share";

function clubInitials(c: PublicClub) {
  return (c.shortName || c.name.split(/\s+/).map((s) => s[0]).join("")).slice(0, 3).toUpperCase();
}

export const Route = createFileRoute("/clubs/$slug")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const club = await getPublicClub({ data: { slug: params.slug } });
    if (!club) throw notFound();
    return { club };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Club unavailable — BallFindr" }, { name: "robots", content: "noindex" }] };
    }
    const c = loaderData.club;
    const description = ["Football club on BallFindr", c.location, c.level ?? c.league].filter(Boolean).join(" | ");
    return shareHead({ title: `${c.name.trim()} — BallFindr`, description, path: sharePath("club", params.slug), image: c.badgeUrl ? shareImageUrl("club", c.slug) : null });
  },
  notFoundComponent: () => (
    <UnavailablePanel title="Club unavailable" body="This club profile isn't available. The link may be out of date." />
  ),
  errorComponent: () => (
    <UnavailablePanel title="Something went wrong" body="We couldn't load this club right now. Please try again shortly." />
  ),
  component: PublicClubPage,
});

function PublicClubPage() {
  const { club: c } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const viewer = useViewer();
  const meta = [c.level, c.league, c.location].filter(Boolean).join(" • ");
  const vacancies = c.vacancies ?? [];

  return (
    <PublicShell>
      <Panel>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar initials={clubInitials(c)} imageUrl={c.badgeUrl} alt={`${c.name} badge`} className="size-16 rounded-2xl object-contain text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl uppercase break-words sm:text-3xl">
              <AccountName truncate={false} className="flex-wrap" verified={c.isVerified} owner={c.isOwner} founder={c.isFounderClub}>{c.name}</AccountName>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{meta || "Football club on BallFindr"}</p>
            {c.location ? <div className="mt-2"><Pill><MapPin className="size-3" />{c.location}</Pill></div> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <ShareButton kind="club" slug={slug} title={`${c.name} on BallFindr`} />
          <AccountAction viewer={viewer} needs="player" label="Save club or register interest" wrongTypeMessage="Only player accounts can save clubs or register interest.">
            <Button asChild variant="volt" size="sm">
              <Link to="/player/clubs/$clubId" params={{ clubId: c.id }}>Open in BallFindr</Link>
            </Button>
          </AccountAction>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel>
            <p className="eyebrow">About</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.description ?? "This club hasn't added a description yet."}</p>
          </Panel>
          <Panel>
            <p className="eyebrow">Open opportunities</p>
            {vacancies.length ? (
              <div className="mt-3 space-y-2">{vacancies.map((v) => <PublicVacancyCard key={v.id} v={v} />)}</div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No open opportunities right now.</p>
            )}
          </Panel>
        </div>
        <Panel className="h-fit">
          <p className="eyebrow">Club information</p>
          <div className="mt-3">
            <DetailRow label="League" value={c.league ?? "—"} />
            <DetailRow label="Level" value={c.level ?? "—"} />
            <DetailRow label="Home ground" value={c.homeGround ?? "—"} />
            <DetailRow label="Founded" value={c.founded ?? "—"} />
            <DetailRow label="Training" value={c.trainingDays.length ? c.trainingDays.join(" & ") : "—"} />
            <DetailRow label="Match day" value={c.matchDay ?? "—"} />
          </div>
        </Panel>
      </div>
    </PublicShell>
  );
}
