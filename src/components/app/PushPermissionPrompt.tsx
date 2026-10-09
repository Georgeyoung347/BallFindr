/**
 * Native-app-only "Stay up to date" screen shown before the OS notification prompt.
 * Shown to signed-in Player/Club users while the OS permission is undecided.
 * Allow is remembered permanently; Not Now (or Escape / Android back) snoozes it
 * for 7 days, after which it may show again if the permission is still undecided.
 * Both are stored locally so it never re-appears during navigation.
 */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPushPermissionState, requestPushPermissionAndRegister } from "@/lib/push-devices";

const SEEN_KEY = "bf_push_prompt_seen";
/** Value stored once the user chose Allow: never ask again (the OS state takes over). */
const DONE_VALUE = "done";
/** Not Now is stored as `later:<epoch ms>`. */
const SNOOZE_PREFIX = "later:";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function store(value: string) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    /* ignore */
  }
}

const markDone = () => store(DONE_VALUE);
const snooze = () => store(`${SNOOZE_PREFIX}${Date.now()}`);

/**
 * True when the prompt may be shown (permission still has to be undecided).
 * The legacy value "1" (old Not Now/Allow) and anything unrecognised count as
 * a Not Now from today: re-dated now, so they are re-asked in 7 days.
 */
function snoozeElapsed(): boolean {
  let value: string | null;
  try {
    value = localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
  if (!value) return true;
  if (value === DONE_VALUE) return false;
  const at = value.startsWith(SNOOZE_PREFIX) ? Number(value.slice(SNOOZE_PREFIX.length)) : NaN;
  const now = Date.now();
  // Unknown/legacy values, or a timestamp in the future (clock change): restart the snooze.
  if (!Number.isFinite(at) || at > now) {
    snooze();
    return false;
  }
  return now - at >= SNOOZE_MS;
}

export function PushPermissionPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!snoozeElapsed()) return;
      const state = await getPushPermissionState();
      // Only when undecided; granted/denied/browser never show.
      if (!cancelled && (state === "prompt" || state === "prompt-with-rationale")) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const notNow = () => {
    snooze();
    setOpen(false);
  };

  // Escape (also the Android back button, see lib/native-ui) acts like Not Now.
  // preventDefault marks it handled so the back button doesn't navigate the page
  // underneath; while the OS prompt is in flight it is swallowed but ignored.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (busy) return;
      snooze();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="w-full max-w-sm py-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-8 w-8" />
        </div>
        <h2 id="push-prompt-title" className="text-2xl font-bold text-foreground">
          Stay up to date with BallFindr
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Get notifications about your applications, trials, messages and recruitment activity.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            className="h-12 w-full text-base"
            disabled={busy}
            onClick={async () => {
              // Saved before the OS prompt so a crash/kill during it can't lose the choice.
              markDone();
              setBusy(true);
              try {
                await requestPushPermissionAndRegister();
              } catch {
                /* silent: the OS permission state decides from here */
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
          >
            Allow Notifications
          </Button>
          <Button
            variant="ghost"
            className="h-12 w-full text-base"
            disabled={busy}
            onClick={notNow}
          >
            Not Now
          </Button>
        </div>
      </div>
    </div>
  );
}
