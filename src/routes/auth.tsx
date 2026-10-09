/**
 * Sign in / sign up page for players and clubs (Supabase Auth). After sign-in routes to /player or /club using profiles.account_type; supports return-to URLs from share pages.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { OnboardingShell } from "@/components/site/OnboardingShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { takeReturnTo } from "@/lib/share";
import { CLUB_SECTIONS, FOOTBALL_SECTIONS, type ClubSection } from "@/lib/football-section";

const title = "Sign in or create your BallFindr account";
const description =
  "Create a BallFindr player or club account, or sign in to manage your profile, vacancies and applications.";

type AccountType = "player" | "club";
type Mode = "signin" | "signup";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    type: search['type'] === "club" ? ("club" as const) : ("player" as const),
    mode: search['mode'] === "signin" ? ("signin" as const) : ("signup" as const),
  }),
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
  component: AuthPage,
});

const field =
  "w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-base md:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

/** Days in a calendar month (month is 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses a date input's "YYYY-MM-DD" into plain calendar parts. Deliberately
 * not new Date(value): that reads it as UTC midnight, which is the previous
 * evening in UK summer time and shifts the birthday by a day.
 */
function parseDateOnly(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** True when the date of birth is 16 years ago or earlier in the user's local calendar. */
function isAtLeast16(value: string, today: Date = new Date()): boolean {
  const dob = parseDateOnly(value);
  if (!dob) return false;
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  // Birthday not reached yet this year (a 29 Feb birthday counts from 1 Mar).
  const beforeBirthday = m < dob.m || (m === dob.m && d < dob.d);
  return y - dob.y - (beforeBirthday ? 1 : 0) >= 16;
}

/** Latest date of birth (local "YYYY-MM-DD") that still meets the 16+ requirement. */
function maxDateOfBirth(today: Date = new Date()): string {
  const y = today.getFullYear() - 16;
  const m = today.getMonth() + 1;
  const d = Math.min(today.getDate(), daysInMonth(y, m));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode);
  const [accountType, setAccountType] = useState<AccountType>(search.type);
  // Players may only pick one side; clubs may also pick "both".
  const [footballSection, setFootballSection] = useState<ClubSection | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const goToWorkspace = (type: AccountType) => {
    const back = takeReturnTo();
    if (back) return void navigate({ href: back });
    void navigate({ to: type === "club" ? "/club" : "/player" });
  };

  // Restore a saved Supabase session: if the user is already signed in on this
  // device, skip the sign-in form. getUser() re-validates with Supabase Auth, so
  // an expired or revoked session simply shows the form as normal.
  useEffect(() => {
    if (search.mode !== "signin") return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled || error || !data.user) return;
      const type = await resolveAccountType(
        data.user.id,
        data.user.user_metadata?.["account_type"] as string | undefined,
      );
      if (cancelled) return;
      const back = takeReturnTo();
      if (back) return void navigate({ href: back, replace: true });
      void navigate({ to: type === "club" ? "/club" : "/player", replace: true });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Trust profiles.account_type, falling back to signup metadata. */
  async function resolveAccountType(userId: string, fallback?: string): Promise<AccountType> {
    const { data } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .maybeSingle();
    const value = data?.account_type ?? fallback;
    return value === "club" ? "club" : "player";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        // BallFindr is 16+. The same rule is enforced again in the database on account creation.
        if (!isAtLeast16(dateOfBirth)) {
          toast.error("BallFindr is currently available only to people aged 16 and over.");
          return;
        }
        if (!acceptedTerms) {
          toast.error("Please accept the Terms & Conditions to create your account.");
          return;
        }
        if (!footballSection || (accountType === "player" && footballSection === "both")) {
          toast.error(
            accountType === "club"
              ? "Please choose which football your club operates."
              : "Please choose whether you're joining Men's or Women's Football.",
          );
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              account_type: accountType,
              display_name: displayName || email.split("@")[0],
              // Players: stored privately (never shown publicly, only the calculated age is).
              // Clubs: used for the age check only and not kept on the profile.
              date_of_birth: dateOfBirth,
              // Saved on the new player or club record by handle_new_user().
              football_section: footballSection,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
        toast.success("Account created");
        // Optional setup screen; the player/club record already exists.
        void navigate({ to: "/welcome" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const type = await resolveAccountType(
          data.user!.id,
          data.user?.user_metadata?.['account_type'] as string | undefined,
        );
        if (type !== accountType) {
          await supabase.auth.signOut();
          toast.error(
            type === "club"
              ? "That's a club account. Choose Club above to sign in."
              : "That's a player account. Choose Player above to sign in.",
          );
          setAccountType(type);
          return;
        }
        goToWorkspace(type);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      // The database refuses under-16 signups too; keep the wording friendly.
      toast.error(
        /16 or over|Database error saving new user/i.test(message) && mode === "signup"
          ? "BallFindr is currently available only to people aged 16 and over."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <OnboardingShell
        eyebrow="Almost there"
        title="Confirm your email"
        description={`We've sent a confirmation link to ${email}. Click it to activate your BallFindr account, then sign in.`}
      >
        <Button variant="voltOutline" size="lg" onClick={() => { setCheckEmail(false); setMode("signin"); }}>
          Back to sign in
        </Button>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      eyebrow={mode === "signup" ? "Create account" : "Log in"}
      title={mode === "signup" ? "Join BallFindr" : "Welcome back"}
      description={
        mode === "signup"
          ? "Choose how you'll use BallFindr and create your account."
          : "Sign in to your player or club account."
      }
    >
      <form onSubmit={onSubmit} className="surface-card space-y-4 rounded-2xl p-6">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-elevated/50 p-1">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                mode === m
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "signin" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["player", "club"] as AccountType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setAccountType(t);
                // Players can never be "both".
                if (t === "player" && footballSection === "both") setFootballSection(null);
              }}
              className={cn(
                "rounded-xl border px-3 py-2.5 font-display text-sm uppercase tracking-wide transition-colors",
                accountType === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "player" ? "Player" : "Club"}
            </button>
          ))}
        </div>

        {mode === "signup" ? (
          <div className="space-y-1.5">
            <span className="block text-xs tracking-wide text-muted-foreground uppercase">
              {accountType === "club"
                ? "Which football does your club operate?"
                : "Which section are you joining?"}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(accountType === "club" ? CLUB_SECTIONS : FOOTBALL_SECTIONS).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFootballSection(option.value)}
                  aria-pressed={footballSection === option.value}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                    footballSection === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="block text-xs text-muted-foreground">
              {accountType === "club"
                ? "Choose both if you run men's and women's teams — one account, and you switch side from your dashboard."
                : "You'll only see clubs and opportunities in the section you choose."}
            </span>
          </div>
        ) : null}

        {mode === "signup" ? (
          <label className="block space-y-1.5">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              {accountType === "club" ? "Club name" : "Full name"}
            </span>
            <input
              className={field}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={accountType === "club" ? "Example FC" : "Jack Smith"}
              required
            />
          </label>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Email</span>
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
          <span className="text-xs tracking-wide text-muted-foreground uppercase">Password</span>
          <input
            className={field}
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        {mode === "signin" ? (
          <p className="-mt-1 text-right">
            <Link to="/forgot-password" className="text-xs font-semibold text-primary">
              Forgot password?
            </Link>
          </p>
        ) : null}

        {mode === "signup" ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs tracking-wide text-muted-foreground uppercase">
                Date of birth
              </span>
              <input
                className={field}
                type="date"
                value={dateOfBirth}
                max={maxDateOfBirth()}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
              <span className="block text-xs text-muted-foreground">
                You must be 16 or over to use BallFindr. Your date of birth is never shown on your
                profile.
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-elevated/50 p-3">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                required
              />
              <span className="text-left text-xs leading-relaxed text-muted-foreground">
                By creating a BallFindr account, you agree to our{" "}
                <Link to="/terms" className="font-semibold text-primary">
                  Terms &amp; Conditions
                </Link>{" "}
                and acknowledge our{" "}
                <Link to="/privacy" className="font-semibold text-primary">
                  Privacy Notice
                </Link>
                .
              </span>
            </label>
          </>
        ) : null}

        <Button type="submit" variant="volt" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New to BallFindr?"}{" "}
          <button
            type="button"
            className="font-semibold text-primary"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </form>
    </OnboardingShell>
  );
}
