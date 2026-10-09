/**
 * Native-app-only "Stay up to date" screen shown before the OS notification prompt.
 * Appears once per device for signed-in Player/Club users while permission is undecided.
 * Not Now / Allow are remembered locally so it never re-appears during navigation.
 */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPushPermissionState, requestPushPermissionAndRegister } from "@/lib/push-devices";

const SEEN_KEY = "bf_push_prompt_seen";

export function PushPermissionPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
      } catch {
        return;
      }
      const state = await getPushPermissionState();
      // Only when undecided; granted/denied/browser never show.
      if (!cancelled && (state === "prompt" || state === "prompt-with-rationale")) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

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
              setBusy(true);
              await requestPushPermissionAndRegister();
              close();
            }}
          >
            Allow Notifications
          </Button>
          <Button variant="ghost" className="h-12 w-full text-base" disabled={busy} onClick={close}>
            Not Now
          </Button>
        </div>
      </div>
    </div>
  );
}
