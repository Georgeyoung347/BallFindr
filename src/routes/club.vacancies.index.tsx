/**
 * Club > Vacancies: manage open/closed vacancies, each with Share.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/ui";
import {
  vacancyTitleFor,
  positionLabels,
  useClubVacancies,
  useSetVacancyStatus,
  vacancyStatusLabels,
} from "@/lib/club-vacancies";
import { cn } from "@/lib/utils";
import { VacancySignDialog } from "@/components/club/VacancySignDialog";
import { useClubTrialEntries } from "@/lib/trial-outcomes";
import { ShareButton } from "@/components/app/ShareButton";
import { useShareSlug } from "@/lib/share";

const title = "My vacancies — BallFindr";
const description =
  "Manage the positions your club is recruiting for, edit your listings and close them when filled.";

export const Route = createFileRoute("/club/vacancies/")({
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
  component: VacanciesPage,
});

function postedAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

function ShareVacancy({ id, title }: { id: string; title: string }) {
  const slug = useShareSlug("vacancy", id);
  return <ShareButton kind="vacancy" slug={slug} title={`${title} on BallFindr`} />;
}

function VacanciesPage() {
  const { data: vacancies = [], isLoading } = useClubVacancies();
  const setStatus = useSetVacancyStatus();
  const { data: trialEntries = [] } = useClubTrialEntries();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My vacancies"
        subtitle="Positions your club is currently recruiting for."
        action={
          <Button asChild variant="volt" size="sm">
            <Link to="/club/vacancies/new">+ Post a vacancy</Link>
          </Button>
        }
      />

      <div className="space-y-3">
        {isLoading ? (
          <EmptyState title="Loading vacancies…" body="Fetching the roles you've posted." />
        ) : vacancies.length ? (
          vacancies.map((v) => (
            <Panel key={v.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg uppercase">
                      {vacancyTitleFor(v.positions) ?? "Vacancy"}
                    </h2>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-semibold",
                        v.status === "active"
                          ? "text-[color:var(--success)]"
                          : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          v.status === "active"
                            ? "bg-[color:var(--success)]"
                            : "bg-muted-foreground",
                        )}
                      />
                      {vacancyStatusLabels[v.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[v.levelName, v.location].filter(Boolean).join(" • ")}
                    {v.levelName || v.location ? " • " : ""}posted {postedAgo(v.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ShareVacancy id={v.id} title={vacancyTitleFor(v.positions) ?? "Vacancy"} />
                  {trialEntries.some((t) => t.vacancyId === v.id) ? (
                    <VacancySignDialog
                      vacancyTitle={vacancyTitleFor(v.positions) ?? "Vacancy"}
                      entries={trialEntries.filter((t) => t.vacancyId === v.id)}
                    />
                  ) : null}
                  <Button asChild variant="subtle" size="sm">
                    <Link to="/club/vacancies/$vacancyId/edit" params={{ vacancyId: v.id }}>
                      Edit
                    </Link>
                  </Button>
                  {v.status === "active" ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate(
                          { id: v.id, status: "closed" },
                          {
                            onSuccess: () => toast("Vacancy closed"),
                            onError: (e: unknown) =>
                              toast.error(
                                e instanceof Error ? e.message : "Could not close vacancy",
                              ),
                          },
                        )
                      }
                    >
                      Close
                    </Button>
                  ) : (
                    <Button
                      variant="quiet"
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate(
                          { id: v.id, status: "active" },
                          { onSuccess: () => toast("Vacancy reopened") },
                        )
                      }
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
              {v.description ? (
                <p className="mt-3 text-sm text-muted-foreground">{v.description}</p>
              ) : null}
              {v.requirements ? (
                <p className="mt-2 text-xs text-muted-foreground">{v.requirements}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {v.positions.map((p) => (
                  <Pill key={p}>{positionLabels[p]}</Pill>
                ))}
                {v.location ? (
                  <Pill>
                    <MapPin className="size-3" />
                    {v.location}
                  </Pill>
                ) : null}
                {v.trainingDays.length ? (
                  <Pill>
                    <CalendarDays className="size-3" />
                    {v.trainingDays.join(" & ")}
                  </Pill>
                ) : null}
                {v.matchDay ? <Pill>Match day: {v.matchDay}</Pill> : null}
                {v.trialsAvailable ? <Pill tone="primary">Trials available</Pill> : null}
                {v.expiresAt ? (
                  <Pill>Expires {new Date(v.expiresAt).toLocaleDateString("en-GB")}</Pill>
                ) : null}
              </div>
            </Panel>
          ))
        ) : (
          <EmptyState
            title="No vacancies yet"
            body="Post your first vacancy to start receiving applications from players nearby."
          />
        )}
      </div>
    </div>
  );
}
