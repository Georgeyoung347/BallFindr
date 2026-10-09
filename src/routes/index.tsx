/**
 * Homepage. If a saved session exists, validates it and redirects to /player or /club; otherwise shows marketing sections.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { ForPlayers } from "@/components/landing/ForPlayers";
import { ForClubs } from "@/components/landing/ForClubs";
import { SocialProof } from "@/components/landing/SocialProof";
import { VisionSection } from "@/components/landing/VisionSection";
import { FinalCta } from "@/components/landing/FinalCta";
import socialImage from "@/assets/ballfindr-social.jpg.asset.json";

const title = "BallFindr — Find your next club. Find your next player.";
const description =
  "BallFindr connects non-league and semi-pro players looking for their next club with clubs looking for their next player. Football recruitment, made simple.";
const socialImageUrl = `https://ballfindr.co.uk${socialImage.url}`;

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ballfindr.co.uk/" },
      { property: "og:image", content: socialImageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: socialImageUrl },
    ],
    links: [{ rel: "canonical", href: "https://ballfindr.co.uk/" }],
  }),
  component: Landing,
});

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** True when Supabase has a saved session in this browser (no network call). */
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // storage unavailable — treat as signed out
  }
  return false;
}

function Landing() {
  const navigate = useNavigate();
  const [restoring, setRestoring] = useState(false);

  // Before paint, only show the loader if a saved session exists, so signed-out
  // visitors never see a spinner.
  useIsoLayoutEffect(() => {
    if (hasStoredSession()) setRestoring(true);
  }, []);

  useEffect(() => {
    if (!hasStoredSession()) return;
    let cancelled = false;
    void (async () => {
      // getUser() re-validates with Supabase Auth; expired/revoked sessions fail.
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        setRestoring(false);
        return;
      }
      // Same real account-type check as the sign-in page: profiles.account_type,
      // falling back to signup metadata only if the profile can't be read.
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      const value =
        profile?.account_type ?? (data.user.user_metadata?.["account_type"] as string | undefined);
      void navigate({ to: value === "club" ? "/club" : "/player", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="sr-only">Signing you in…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSection />
        <ProductPreview />
        <HowItWorks />
        <ForPlayers />
        <ForClubs />
        <SocialProof />
        <VisionSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
