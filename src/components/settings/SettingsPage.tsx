/**
 * Central Settings for signed-in players and clubs. Reuses the existing
 * appearance, notification-preference and account-deletion sections; email and
 * password changes go through Supabase Auth for the signed-in user only.
 */
import { deactivateCurrentDevice } from "@/lib/push-devices";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, KeyRound, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/app/ui";
import { supabase } from "@/integrations/supabase/client";
import { AppearanceSection } from "@/components/profile/AppearanceSection";
import { NotificationPreferencesSection } from "@/components/profile/NotificationPreferencesSection";
import { DeleteAccountSection } from "@/components/profile/DeleteAccountSection";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="eyebrow px-1 pt-4">{children}</h2>;
}

function useAuthEmail() {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      supabase.auth.getUser().then(({ data }) => {
        if (!alive) return;
        setEmail(data.user?.email ?? null);
        setPending(data.user?.new_email ?? null);
      });
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { email, pending, setPending };
}

function EmailSection() {
  const { email, pending, setPending } = useAuthEmail();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim().toLowerCase();
    setError(null);
    if (!EMAIL_RE.test(next) || next.length > 254) return setError("Enter a valid email address.");
    if (next === email?.toLowerCase()) return setError("That is already your login email.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/auth` },
    );
    setBusy(false);
    if (err) {
      // Generic message: never reveal whether another account uses the address.
      setError(
        /rate|security purposes/i.test(err.message)
          ? "Too many attempts. Please wait a minute and try again."
          : "We couldn't start the email change. Check the address and try again.",
      );
      return;
    }
    setSent(next);
    setPending(next);
    setValue("");
    setOpen(false);
  }

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Login email</h3>
          <p className="mt-1 break-all text-sm text-muted-foreground">{email ?? "Loading…"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Only you can see this. It is never shown on your public profile.</p>
        </div>
      </div>
      {sent || pending ? (
        <p role="status" className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
          Change requested to <span className="break-all font-semibold">{sent ?? pending}</span>. Open the
          confirmation link we emailed you to finish. Your current email keeps working until the change is
          confirmed. If you don't see it, check your spam folder.
        </p>
      ) : null}
      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <Label htmlFor="new-email">New email address</Label>
          <Input id="new-email" type="email" autoComplete="email" inputMode="email" value={value} disabled={busy} onChange={(e) => setValue(e.target.value)} className="h-11" />
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={busy || !value.trim()} className="h-11 flex-1 sm:flex-none">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Send confirmation
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="mt-3 h-11 w-full sm:w-auto" onClick={() => { setOpen(true); setSent(null); }}>Change email</Button>
      )}
    </Panel>
  );
}

function PasswordSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false); setCurrent(""); setNext(""); setConfirm(""); setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter your current password.");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords don't match.");
    if (next === current) return setError("New password must be different from your current one.");
    setBusy(true);
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) { setBusy(false); return setError("Your session has expired. Please sign in again."); }
    // Re-check the current password for this same account before changing it.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (authErr) { setBusy(false); return setError("Current password is incorrect."); }
    const { error: err } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (err) {
      return setError(/weak|pwned|leaked/i.test(err.message)
        ? "That password is too weak or has appeared in a data breach. Choose a different one."
        : "Your password couldn't be changed. Please try again.");
    }
    toast.success("Password changed.");
    close();
  }

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Password</h3>
          <p className="mt-1 text-xs text-muted-foreground">Change the password you use to sign in. At least 8 characters.</p>
        </div>
      </div>
      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="space-y-1.5"><Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} disabled={busy} onChange={(e) => setCurrent(e.target.value)} className="h-11" /></div>
          <div className="space-y-1.5"><Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} className="h-11" /></div>
          <div className="space-y-1.5"><Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} className="h-11" /></div>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className="h-11 flex-1 sm:flex-none">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Update password
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={close}>Cancel</Button>
          </div>
          <Link to="/forgot-password" className="block text-xs text-muted-foreground underline underline-offset-4">Forgotten your current password?</Link>
        </form>
      ) : (
        <Button variant="outline" className="mt-3 h-11 w-full sm:w-auto" onClick={() => setOpen(true)}>Change password</Button>
      )}
    </Panel>
  );
}

function VerificationSection() {
  const { data: status } = useQuery({
    queryKey: ["me", "verification-status"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("verification_status").eq("id", u.user.id).maybeSingle();
      return (data?.verification_status as string | null) ?? null;
    },
  });
  const verified = status === "verified";
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <BadgeCheck className={verified ? "mt-0.5 size-4 shrink-0 text-primary" : "mt-0.5 size-4 shrink-0 text-muted-foreground"} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{verified ? "Verified" : "Not verified"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {verified
              ? "Your account shows the BallFindr verified badge."
              : "Verification is granted by the BallFindr team. There's nothing you need to do here right now."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function LinkRow({ to, label }: { to: "/privacy" | "/terms" | "/cookies"; label: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-1 text-sm last:border-b-0 hover:text-primary">
      {label} <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

export function SettingsPage({ accountType }: { accountType: "player" | "club" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = async () => {
    await deactivateCurrentDevice();
    await supabase.auth.signOut();
    queryClient.clear(); // never show this account's cached data to the next one
    void navigate({ to: "/", replace: true });
  };
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 pb-6">
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="mt-1 font-display text-3xl uppercase">Settings</h1>
      </div>

      <Heading>Appearance</Heading>
      <AppearanceSection />

      <Heading>Notifications</Heading>
      <NotificationPreferencesSection />

      <Heading>Account</Heading>
      <EmailSection />
      <PasswordSection />

      <Heading>Verification</Heading>
      <VerificationSection />

      <Heading>Privacy &amp; Security</Heading>
      <Panel>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            Your login email and password are private to you. To report or block someone, use the options on
            their profile or in your conversation with them.
          </p>
        </div>
      </Panel>

      <Heading>Legal</Heading>
      <Panel className="py-1">
        <LinkRow to="/privacy" label="Privacy Policy" />
        <LinkRow to="/terms" label="Terms & Conditions" />
        <LinkRow to="/cookies" label="Cookie Policy" />
      </Panel>

      <Heading>Account actions</Heading>
      <Panel>
        <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={() => void signOut()}>
          <LogOut className="size-4" /> Log out
        </Button>
      </Panel>
      <DeleteAccountSection accountType={accountType} />
    </div>
  );
}
