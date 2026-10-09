/**
 * Set a new password after following the reset email link (Supabase recovery session).
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { OnboardingShell } from "@/components/site/OnboardingShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const title = "Create a new BallFindr password";
const description = "Set a new password for your BallFindr account.";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

const field =
  "w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-base md:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

type LinkState = "checking" | "valid" | "invalid";

function ResetPasswordPage() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    // An error in the URL means the link expired or was already used.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("error") || query.get("error")) {
      setLinkState("invalid");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setLinkState("valid");
      }
    });

    // The client processes the recovery link on load; give it a moment, then check.
    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setLinkState(data.session ? "valid" : "invalid");
      });
    }, 1200);

    return () => {
      active = false;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        "We couldn't update your password. Your reset link may have expired — request a new one.",
      );
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
  }

  if (done) {
    return (
      <OnboardingShell
        eyebrow="All set"
        title="Password updated"
        description="Your BallFindr password has been changed. You can now log in with your new password."
      >
        <div className="surface-card rounded-2xl p-6">
          <Button asChild variant="volt" size="lg" className="w-full">
            <Link to="/auth" search={{ type: "player", mode: "signin" }}>
              Go to log in
            </Link>
          </Button>
        </div>
      </OnboardingShell>
    );
  }

  if (linkState === "checking") {
    return (
      <OnboardingShell
        eyebrow="One moment"
        title="Checking your link"
        description="We're verifying your password reset link."
      >
        <div className="surface-card rounded-2xl p-6 text-sm text-muted-foreground">Please wait…</div>
      </OnboardingShell>
    );
  }

  if (linkState === "invalid") {
    return (
      <OnboardingShell
        eyebrow="Link expired"
        title="This reset link is no longer valid"
        description="Password reset links expire and can only be used once. Request a new one and we'll email you a fresh link."
      >
        <div className="surface-card grid grid-cols-1 gap-2 rounded-2xl p-6 sm:grid-cols-2">
          <Button asChild variant="volt" size="lg">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
          <Button asChild variant="voltOutline" size="lg">
            <Link to="/auth" search={{ type: "player", mode: "signin" }}>
              Back to log in
            </Link>
          </Button>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      eyebrow="Password reset"
      title="Create a new password"
      description="Choose a new password for your BallFindr account."
    >
      <form onSubmit={onSubmit} className="surface-card space-y-4 rounded-2xl p-6">
        <label className="block space-y-1.5">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">New password</span>
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Confirm password
          </span>
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </label>

        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• At least 8 characters</li>
          <li>• Both fields must match</li>
          <li>• Avoid a password you use on other sites</li>
        </ul>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <Button type="submit" variant="volt" size="lg" className="w-full" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link
            to="/auth"
            search={{ type: "player", mode: "signin" }}
            className="font-semibold text-primary"
          >
            Back to log in
          </Link>
        </p>
      </form>
    </OnboardingShell>
  );
}
