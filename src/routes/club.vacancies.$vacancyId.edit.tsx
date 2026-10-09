/**
 * Club > edit an existing vacancy (VacancyForm).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { VacancyFormFields } from "@/components/club/VacancyForm";
import { toForm, useClubVacancy, useUpdateVacancy } from "@/lib/club-vacancies";

const title = "Edit vacancy — BallFindr";
const description = "Update the details of a vacancy your club is recruiting for.";

export const Route = createFileRoute("/club/vacancies/$vacancyId/edit")({
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
  component: EditVacancy,
});

function EditVacancy() {
  const { vacancyId } = Route.useParams();
  const navigate = useNavigate();
  const { data: vacancy, isLoading } = useClubVacancy(vacancyId);
  const update = useUpdateVacancy();

  return (
    <div className="space-y-6">
      <Button asChild variant="quiet" size="sm" className="-ml-2">
        <Link to="/club/vacancies">
          <ArrowLeft className="size-4" /> Back to vacancies
        </Link>
      </Button>

      <PageHeader title="Edit vacancy" subtitle="Keep your listing accurate and up to date." />

      {isLoading ? (
        <EmptyState title="Loading vacancy…" body="Fetching your vacancy details." />
      ) : !vacancy ? (
        <EmptyState
          title="Vacancy not found"
          body="This vacancy no longer exists or belongs to another club."
        />
      ) : (
        <VacancyFormFields
          initial={toForm(vacancy)}
          submitLabel="Save changes"
          pending={update.isPending}
          showStatus
          onSubmit={(form) => {
            update.mutate(
              { id: vacancy.id, form },
              {
                onSuccess: () => {
                  toast.success("Vacancy updated");
                  void navigate({ to: "/club/vacancies" });
                },
                onError: (e: unknown) =>
                  toast.error(e instanceof Error ? e.message : "Could not save vacancy"),
              },
            );
          }}
          onCancel={
            <Button asChild variant="quiet">
              <Link to="/club/vacancies">Cancel</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
