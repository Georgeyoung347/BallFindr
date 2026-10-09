/**
 * Club > create a new vacancy (VacancyForm).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/ui";
import { VacancyFormFields } from "@/components/club/VacancyForm";
import { emptyVacancyForm, useCreateVacancy } from "@/lib/club-vacancies";
import { useSignedInClubProfile } from "@/lib/club-profile";

const title = "Post a vacancy — BallFindr";
const description =
  "Create a new player vacancy for your club: positions, level, location, training details and requirements.";

export const Route = createFileRoute("/club/vacancies/new")({
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
  component: PostVacancy,
});

function PostVacancy() {
  const navigate = useNavigate();
  const { data: club } = useSignedInClubProfile();
  const create = useCreateVacancy();

  const initial = {
    ...emptyVacancyForm,
    location: club?.location ?? "",
    trainingDays: club?.trainingDays ?? [],
    matchDay: club?.matchDay ?? "",
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="quiet" size="sm" className="-ml-2">
        <Link to="/club/vacancies">
          <ArrowLeft className="size-4" /> Back to vacancies
        </Link>
      </Button>

      <PageHeader title="Post a vacancy" subtitle="Tell players exactly what you're looking for." />

      <VacancyFormFields
        initial={initial}
        submitLabel="Post vacancy"
        pending={create.isPending}
        onSubmit={(form) => {
          create.mutate(form, {
            onSuccess: () => {
              toast.success("Vacancy posted");
              void navigate({ to: "/club/vacancies" });
            },
            onError: (e: unknown) =>
              toast.error(e instanceof Error ? e.message : "Could not post vacancy"),
          });
        }}
        onCancel={
          <Button asChild variant="quiet">
            <Link to="/club/vacancies">Cancel</Link>
          </Button>
        }
      />
    </div>
  );
}
