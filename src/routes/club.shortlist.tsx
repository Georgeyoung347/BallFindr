/**
 * Club > Shortlist of players.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApplicationStageBadge, Avatar, EmptyState, PageHeader, Panel } from "@/components/app/ui";
import { appliedAgo, useClubApplications, useSetApplicationStage } from "@/lib/applications";
import { AccountName } from "@/components/app/AccountName";

const title = "Shortlist — BallFindr club";
const description =
  "Every applicant your club has shortlisted, taken straight from their live application status.";

export const Route = createFileRoute("/club/shortlist")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShortlistPage,
});

/**
 * The shortlist is derived purely from applications.stage = 'shortlisted'.
 * Saved players are a separate concept and are never shown here.
 */
function ShortlistPage() {
  const { data, isLoading, error } = useClubApplications();
  const setStage = useSetApplicationStage();

  const shortlisted = (data ?? []).filter((a) => a.stage === "shortlisted");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shortlist"
        subtitle="Applicants you've shortlisted from their application."
      />

      {isLoading ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Loading shortlist…</p>
        </Panel>
      ) : error ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            We couldn't load your shortlist right now. Please refresh and try again.
          </p>
        </Panel>
      ) : shortlisted.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shortlisted.map((a) => {
            const p = a.player;
            const meta = [p.primaryPosition, p.levelName, p.location].filter(Boolean).join(" • ");
            return (
              <Panel key={a.id}>
                <div className="flex items-start gap-3">
                  <Avatar initials={p.initials} imageUrl={p.photoUrl} alt={`${p.name} profile photo`} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-display text-base uppercase">
                      <Star className="size-4 fill-current text-primary" />
                      <AccountName verified={p.isVerified} owner={p.isOwner}>{p.name}</AccountName>
                    </p>
                    {meta ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
                    ) : null}
                    <div className="mt-1.5">
                      <ApplicationStageBadge stage={a.stage} />
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Applied for {a.positionLabel ?? a.vacancyTitle ?? "your vacancy"} •{" "}
                  {appliedAgo(a.createdAt)}
                  {a.vacancyStatus !== "active" ? " • vacancy closed" : ""}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="volt" size="sm">
                    <Link to="/club/players/$playerId" params={{ playerId: p.id }}>
                      View profile
                    </Link>
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    disabled={setStage.isPending}
                    onClick={() =>
                      setStage.mutate(
                        { id: a.id, stage: "trial" },
                        {
                          onSuccess: () => toast.success(`Trial invite sent to ${p.name}`),
                          onError: (e) =>
                            toast.error("Couldn't update application", {
                              description: e instanceof Error ? e.message : undefined,
                            }),
                        },
                      )
                    }
                  >
                    <Ticket className="size-4" /> Invite to trial
                  </Button>
                  <Button asChild variant="quiet" size="sm">
                    <Link to="/club/applications">Manage application</Link>
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No shortlisted players yet"
          body="Shortlist an applicant from your Applications page and they'll appear here."
        />
      )}
    </div>
  );
}
