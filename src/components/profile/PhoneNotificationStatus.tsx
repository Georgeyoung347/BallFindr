/**
 * Settings → Notifications: shows the phone's own (OS) notification permission.
 * Native app only — renders nothing on the website. Separate from the four
 * BallFindr categories; reuses lib/push-devices for checking/requesting.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPushPermissionState, requestPushPermissionAndRegister } from "@/lib/push-devices";

export function PhoneNotificationStatus() {
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setState(await getPushPermissionState());
  useEffect(() => {
    void refresh();
    // Re-check when returning from iPhone Settings.
    const onVis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!state) return null;
  const granted = state === "granted";
  const denied = state === "denied";

  return (
    <div className="mt-4 rounded-lg border border-border px-3 py-3">
      <span className="block text-xs font-semibold uppercase text-muted-foreground">Phone notifications</span>
      <span className="mt-1 block font-semibold">
        {granted ? "Notifications allowed" : denied ? "Notifications turned off" : "Notifications not set up"}
      </span>
      <span className="block text-sm text-muted-foreground">
        {granted
          ? "BallFindr can send notifications to this phone."
          : denied
            ? "To receive notifications, open your phone's Settings, find BallFindr and turn on Notifications."
            : "Allow notifications so BallFindr can alert you on this phone."}
      </span>
      {!granted && !denied && (
        <Button
          className="mt-3 h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await requestPushPermissionAndRegister();
            await refresh();
            setBusy(false);
          }}
        >
          Allow Notifications
        </Button>
      )}
    </div>
  );
}
