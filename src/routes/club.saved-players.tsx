/**
 * Club > Saved Players list (lib/saved-players).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { MessagePlayerButton } from "@/components/app/messaging/MessagePlayerButton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvailabilityTag, Avatar, EmptyState, PageHeader, Panel, Pill } from "@/components/app/ui";
import { positionLabels } from "@/lib/club-vacancies";
import { useSavedPlayers, useToggleSavedPlayer } from "@/lib/saved-players";
import { AccountName } from "@/components/app/AccountName";

const title = "Saved players — BallFindr club";
const description =
  "Review the players your club has saved and open their profiles when you're ready to make contact.";

export const Route = createFileRoute("/club/saved-players")({
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
  component: SavedPlayersPage,
});

function SavedPlayersPage() {
  const { data: players, isLoading } = useSavedPlayers();
  const toggleSaved = useToggleSavedPlayer();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved players"
        subtitle="The players you've saved while browsing, ready to revisit."
      />

      {isLoading ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Loading saved players…</p>
        </Panel>
      ) : players?.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {players.map((p) => {
            const positionLine = [
              p.age ? `${p.age} years old` : null,
              p.primaryPosition ? positionLabels[p.primaryPosition] : null,
              p.secondaryPositions.length
                ? p.secondaryPositions.map((s) => positionLabels[s] ?? s).join(" / ")
                : null,
              p.levelName,
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <Panel key={p.id}>
                <div className="flex items-start gap-3">
                  <Avatar initials={p.initials} imageUrl={p.photoUrl} alt={`${p.name} profile photo`} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-display text-base uppercase">
                      <Bookmark className="size-4 fill-current text-primary" />
                      <AccountName verified={p.isVerified} owner={p.isOwner}>{p.name}</AccountName>
                    </p>
                    {positionLine ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{positionLine}</p>
                    ) : null}
                    <div className="mt-1.5">
                      <AvailabilityTag availability={p.availability} />
                    </div>
                  </div>
                </div>

                {p.location || p.currentClubName || p.openToTrials ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.location ? <Pill>{p.location}</Pill> : null}
                    {p.currentClubName ? <Pill>{p.currentClubName}</Pill> : null}
                    {p.openToTrials ? <Pill>Open to trials</Pill> : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="volt" size="sm">
                    <Link to="/club/players/$playerId" params={{ playerId: p.id }}>
                      View profile
                    </Link>
                  </Button>
                  <MessagePlayerButton playerId={p.id} size="sm" label="Message" />
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={toggleSaved.isPending}
                    onClick={() =>
                      toggleSaved.mutate(
                        { playerId: p.id, saved: true },
                        {
                          onSuccess: () => toast.success(`${p.name} removed from saved players`),
                          onError: (e) =>
                            toast.error("Couldn't update saved players", {
                              description: e instanceof Error ? e.message : undefined,
                            }),
                        },
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No saved players yet"
          body="Save players while browsing and they'll appear here for easy comparison."
        />
      )}
    </div>
  );
}
