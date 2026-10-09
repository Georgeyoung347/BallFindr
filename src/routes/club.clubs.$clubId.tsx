/**
 * Club viewing another club's profile (uses ClubProfileView).
 */
import { createFileRoute } from "@tanstack/react-router";
import { ClubProfileView } from "@/components/app/ClubProfileView";

// Read-only view of another club's public profile for club accounts (e.g. Club + Admin
// opening a club from the admin area). Reuses the existing public club profile.
export const Route = createFileRoute("/club/clubs/$clubId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Club profile — BallFindr" },
      { name: "description", content: "View a club's public profile on BallFindr." },
      { property: "og:title", content: "Club profile — BallFindr" },
      { property: "og:description", content: "View a club's public profile on BallFindr." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClubClubProfilePage,
});

function ClubClubProfilePage() {
  const { clubId } = Route.useParams();
  return <ClubProfileView clubId={clubId} readOnly />;
}
