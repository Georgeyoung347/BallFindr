/**
 * Join page: choose Player or Club account.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, UserRound } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";

const title = "Get started with BallFindr — Players & Clubs";
const description =
  "Choose how you want to use BallFindr: create a player profile to find clubs, or a club profile to find players.";

export const Route = createFileRoute("/join/")({
  staticData: { sitemap: true },
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
  component: JoinPage,
});

function JoinPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-20 sm:px-8">
        <p className="eyebrow">Get started</p>
        <h1 className="mt-3 text-4xl uppercase sm:text-5xl">Which side of the game are you on?</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Player and club accounts are separate — pick the one that fits and we'll set up the right
          profile.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/join/player"
            className="surface-card group rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-primary/40"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-elevated text-primary">
              <UserRound className="size-5" />
            </span>
            <h2 className="mt-5 font-display text-xl uppercase">I'm a Player</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Build your football profile and discover clubs recruiting near you.
            </p>
          </Link>

          <Link
            to="/join/club"
            className="surface-card group rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-primary/40"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-elevated text-primary">
              <Shield className="size-5" />
            </span>
            <h2 className="mt-5 font-display text-xl uppercase">I'm a Club</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Post vacancies and review available players who fit your level.
            </p>
          </Link>
        </div>

        <div className="surface-card mt-8 flex flex-wrap items-center gap-3 rounded-2xl p-5">
          <div className="mr-auto">
            <p className="eyebrow">Create your account</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up for free and choose whether you're joining BallFindr as a Player or a Club.
            </p>
          </div>
          <Button asChild variant="volt" size="sm">
            <Link to="/join/player">Join as Player</Link>
          </Button>
          <Button asChild variant="voltOutline" size="sm">
            <Link to="/join/club">Join as Club</Link>
          </Button>
        </div>

        <Button asChild variant="quiet" size="sm" className="mt-8 self-start">
          <Link to="/login">Already have an account? Log in</Link>
        </Button>

      </main>
      <SiteFooter />
    </div>
  );
}
