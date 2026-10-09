/**
 * Layout for public share pages (/players, /clubs, /vacancies/{slug}) with header and sign-in prompts.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/ui";
import { supabase } from "@/integrations/supabase/client";
import { rememberReturnTo } from "@/lib/share";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-28 pb-16 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function UnavailablePanel({ title, body }: { title: string; body: string }) {
  return (
    <PublicShell>
      <Panel className="text-center">
        <h1 className="font-display text-2xl uppercase">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild variant="volt" size="sm"><Link to="/">Explore BallFindr</Link></Button>
          <Button asChild variant="subtle" size="sm"><Link to="/join">Join BallFindr</Link></Button>
        </div>
      </Panel>
    </PublicShell>
  );
}

type Viewer = { status: "loading" } | { status: "signed_out" } | { status: "signed_in"; accountType: "player" | "club" };

/** Who is looking at the public page. Read after hydration only. */
export function useViewer(): Viewer {
  const [viewer, setViewer] = useState<Viewer>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return !cancelled && setViewer({ status: "signed_out" });
      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle();
      const type = (profile?.account_type ?? data.user.user_metadata?.["account_type"]) === "club" ? "club" : "player";
      if (!cancelled) setViewer({ status: "signed_in", accountType: type });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return viewer;
}

/**
 * Account-required action. Signed out: saves this page and opens the existing
 * sign-up flow. Signed in as the right account type: renders `children`
 * (a link into the existing in-app page where the action lives).
 */
export function AccountAction({
  viewer,
  needs,
  label,
  children,
  wrongTypeMessage,
}: {
  viewer: Viewer;
  needs: "player" | "club";
  label: string;
  children: ReactNode;
  wrongTypeMessage: string;
}) {
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  if (viewer.status === "loading") return null;
  if (viewer.status === "signed_out") {
    return (
      <div className="space-y-1.5">
        <Button
          variant="volt"
          size="sm"
          onClick={() => {
            rememberReturnTo(href);
            void navigate({ to: "/auth", search: { type: needs, mode: "signup" } });
          }}
        >
          {label}
        </Button>
        <p className="text-xs text-muted-foreground">Sign up or log in to continue.</p>
      </div>
    );
  }
  if (viewer.accountType !== needs) return <p className="text-xs text-muted-foreground">{wrongTypeMessage}</p>;
  return <>{children}</>;
}
