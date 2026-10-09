/**
 * Landing page for BallFindr re-verification links. No sign-in needed: the one-time token
 * from the email is checked on the server.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeEmailReverification } from "@/lib/admin-verification-email.functions";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s["t"] === "string" ? (s["t"] as string) : "" }),
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Verify your email — BallFindr" },
      { name: "description", content: "Confirm your BallFindr email address." },
      { property: "og:title", content: "Verify your email — BallFindr" },
      { property: "og:description", content: "Confirm your BallFindr email address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { t } = Route.useSearch();
  const complete = useServerFn(completeEmailReverification);
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!t) {
        setState("error");
        setMessage("This verification link is invalid. Please ask BallFindr to send a new one.");
        return;
      }
      try {
        await complete({ data: { token: t } });
        if (!cancelled) setState("done");
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setMessage(err instanceof Error ? err.message : "Verification failed.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [t, complete]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-bold text-foreground">
          {state === "working" ? "Verifying your email…" : state === "done" ? "Email verified successfully." : "Verification failed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state === "working" ? "Please wait a moment." : state === "done" ? "Thanks — your BallFindr email address is confirmed." : message}
        </p>
        {state !== "working" && (
          <Link to="/" className="mt-4 inline-block font-semibold text-primary">Continue to BallFindr</Link>
        )}
      </div>
    </main>
  );
}
