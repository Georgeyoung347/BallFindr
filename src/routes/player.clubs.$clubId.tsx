/**
 * Player viewing a club's profile (uses ClubProfileView).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ClubProfileView } from "@/components/app/ClubProfileView";

type ClubSearch = { vacancy?: string | undefined };

export const Route = createFileRoute("/player/clubs/$clubId")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): ClubSearch => {
    const raw = search["vacancy"];
    return typeof raw === "string" ? { vacancy: raw } : {};
  },
  head: () => {
    const title = "Club profile — BallFindr";
    const description = "View a club, its ground, training and open opportunities on BallFindr.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ClubProfilePage,
});

function ClubProfilePage() {
  const { clubId } = Route.useParams();
  const { vacancy } = Route.useSearch();
  return <ClubProfileView clubId={clubId} vacancyId={vacancy} />;
}
