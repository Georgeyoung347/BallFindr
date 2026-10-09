/**
 * Public player share page /players/{slug}: safe fields only via public-share server functions; dynamic social metadata.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AvailabilityTag, Avatar, DetailRow, Panel, Pill } from "@/components/app/ui";
import { AccountName } from "@/components/app/AccountName";
import { ShareButton } from "@/components/app/ShareButton";
import { AccountAction, PublicShell, UnavailablePanel, useViewer } from "@/components/public/PublicShell";
import { getPublicPlayer } from "@/lib/public-share.functions";
import { positionLabels } from "@/lib/club-vacancies";
import { type DbPosition } from "@/lib/player-profile";
import { shareHead, shareImageUrl, sharePath } from "@/lib/share";
import { supabase } from "@/integrations/supabase/client";

const pos = (p: string | null | undefined) => (p ? (positionLabels[p as DbPosition] ?? p) : null);

export const Route = createFileRoute("/players/$slug")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const player = await getPublicPlayer({ data: { slug: params.slug } });
    if (!player) throw notFound();
    return { player };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Profile unavailable — BallFindr" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.player;
    const description = [
      p.availability === "not_looking" ? "Footballer on BallFindr" : "Footballer looking for a new club",
      pos(p.primaryPosition),
    ].filter(Boolean).join(" | ");
    return shareHead({ title: `${p.name.trim()} — BallFindr`, description, path: sharePath("player", params.slug), image: p.avatarUrl ? shareImageUrl("player", p.slug) : null, type: "profile" });
  },
  notFoundComponent: () => (
    <UnavailablePanel title="Profile unavailable" body="This player profile isn't available. The link may be out of date." />
  ),
  errorComponent: () => (
    <UnavailablePanel title="Something went wrong" body="We couldn't load this profile right now. Please try again shortly." />
  ),
  component: PublicPlayerPage,
});

/** Signed-in club viewers resolve the in-app player id from the member-only slug view; anonymous visitors never get it. */
function usePlayerIdForMembers(slug: string, enabled: boolean) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void supabase
      .from("player_share_slugs" as never)
      .select("id" as never)
      .eq("slug" as never, slug as never)
      .maybeSingle()
      .then(({ data }) => {
        const value = (data as { id?: string } | null)?.id;
        if (!cancelled && value) setId(value);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, enabled]);
  return id;
}

function PublicPlayerPage() {
  const { player: p } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const viewer = useViewer();
  const memberId = usePlayerIdForMembers(slug, viewer.status === "signed_in" && viewer.accountType === "club");
  const initials = p.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const secondary = p.secondaryPositions.map(pos).filter(Boolean).join(" / ");
  const meta = [pos(p.primaryPosition), p.level].filter(Boolean).join(" • ");

  return (
    <PublicShell>
      <Panel>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar initials={initials} imageUrl={p.avatarUrl} alt={`${p.name} profile photo`} className="size-16 rounded-2xl text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl uppercase sm:text-3xl">
              <AccountName verified={p.isVerified} owner={p.isOwner}>{p.name}</AccountName>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{meta || "Footballer on BallFindr"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AvailabilityTag availability={p.availability} />
              {p.openToTrials ? <Pill>Open to trials</Pill> : null}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <ShareButton kind="player" slug={slug} title={`${p.name} on BallFindr`} />
          <AccountAction viewer={viewer} needs="club" label="Message or save player" wrongTypeMessage="Only club accounts can message or save players.">
            {memberId ? (
              <Button asChild variant="volt" size="sm">
                <Link to="/club/players/$playerId" params={{ playerId: memberId }}>Open in BallFindr</Link>
              </Button>
            ) : null}
          </AccountAction>
        </div>
      </Panel>

      <Panel className="h-fit">
        <p className="eyebrow">Playing information</p>
        <div className="mt-3">
          <DetailRow label="Primary position" value={pos(p.primaryPosition) ?? "—"} />
          <DetailRow label="Secondary position" value={secondary || "—"} />
          <DetailRow label="Current level" value={p.level ?? "—"} />
          <DetailRow label="Preferred level" value={p.preferredLevel ?? "—"} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Sign in to BallFindr to see this player's full profile.</p>
      </Panel>
    </PublicShell>
  );
}
