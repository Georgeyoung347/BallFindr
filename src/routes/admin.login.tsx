/**
 * Separate admin sign-in page; only staff accounts may continue into /admin.
 */
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";

/**
 * Private administrator sign-in.
 *
 * Uses the same Supabase authentication as the rest of BallFindr — there is no
 * separate admin signup. Signing in here only works if the account already
 * holds the admin role in public.user_roles.
 */
export const Route = createFileRoute("/admin/login")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: "BallFindr Administration" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private BallFindr administration sign-in." },
      { property: "og:title", content: "BallFindr Administration" },
      { property: "og:description", content: "Private BallFindr administration sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLoginPage,
});

const field =
  "w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Authorisation is decided server-side against user_roles.
      const status = await getAdminStatus();
      if (!status.isAdmin && !status.isModerator) {
        await supabase.auth.signOut();
        toast.error("This account does not have administrator or moderator access.");
        return;
      }
      void navigate({ to: status.isAdmin ? "/admin" : "/admin/reports" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Restricted</p>
        <h1 className="mt-2 text-3xl uppercase">Administration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with an authorised BallFindr administrator account.
        </p>
        <form onSubmit={onSubmit} className="surface-card mt-6 space-y-4 rounded-2xl p-6">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Email</span>
            <input
              className={field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Password</span>
            <input
              className={field}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button type="submit" variant="volt" size="lg" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
