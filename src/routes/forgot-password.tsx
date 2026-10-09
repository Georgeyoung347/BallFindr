/**
 * Request a password reset email (Supabase Auth).
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { OnboardingShell } from "@/components/site/OnboardingShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const title = "Reset your BallFindr password";
const description =
  "Enter the email address associated with your BallFindr account and we'll send you a password reset link.";

export const Route = createFileRoute("/forgot-password")({
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
  component: ForgotPasswordPage,
});

const field =
  "w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-base md:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

/** Where the emailed recovery link lands. Production domain in production, current origin elsewhere. */
function resetRedirectUrl() {
  const host = window.location.hostname;
  const origin =
    host.endsWith("ballfindr.co.uk") || host.endsWith("lovable.app") || host === "localhost"
      ? window.location.origin
      : "https://ballfindr.co.uk";
  return `${origin}/reset-password`;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Never branch on the result: the same message shows whether or not the account exists.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetRedirectUrl(),
      });
    } catch {
      /* deliberately silent — no account enumeration */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <OnboardingShell
        eyebrow="Check your inbox"
        title="Reset link sent"
        description="If an account exists with that email address, we've sent you a password reset link."
      >
        <div className="surface-card space-y-4 rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">
            The link is valid for a limited time. If it doesn't arrive, check your spam folder or
            request another one.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="voltOutline" size="lg" onClick={() => setSent(false)}>
              Send another link
            </Button>
            <Button asChild variant="volt" size="lg">
              <Link to="/auth" search={{ type: "player", mode: "signin" }}>
                Back to log in
              </Link>
            </Button>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      eyebrow="Password help"
      title="Reset your password"
      description="Enter the email address associated with your BallFindr account and we'll send you a password reset link."
    >
      <form onSubmit={onSubmit} className="surface-card space-y-4 rounded-2xl p-6">
        <label className="block space-y-1.5">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Email</span>
          <input
            className={field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <Button type="submit" variant="volt" size="lg" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Remembered it?{" "}
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
