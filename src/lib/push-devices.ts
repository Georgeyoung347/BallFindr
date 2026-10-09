// Native push device registration (Capacitor app only). Stores the device's
// push token in public.push_devices for the signed-in account (owner-only RLS).
// Never requests permission — the permission flow is a separate stage.
// Browsers do nothing here. All failures are silent so sign-in/app use is never blocked.
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "bf_push_device"; // { token, userId } of the last registration on this device

type Stored = { token: string; userId: string };

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications");
  } catch {
    return false;
  }
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStored(v: Stored | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

let inFlight = false;

/** PostgREST/Postgres "function does not exist" (RPC not deployed yet). */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

/** Register this device for the currently signed-in account, if permission is already granted. */
export async function registerCurrentDevice(): Promise<void> {
  if (!isNativeApp() || inFlight) return;
  inFlight = true;
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;

    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") return; // never prompt here

    const token = await new Promise<string | null>((resolve) => {
      let done = false;
      const finish = (t: string | null) => {
        if (done) return;
        done = true;
        void ok.then((h) => h.remove());
        void err.then((h) => h.remove());
        resolve(t);
      };
      const ok = PushNotifications.addListener("registration", (t) => finish(t.value));
      const err = PushNotifications.addListener("registrationError", () => finish(null));
      setTimeout(() => finish(null), 15000);
      PushNotifications.register().catch(() => finish(null));
    });
    if (!token) return;

    // Confirm the session is still the same account before saving.
    const { data: again } = await supabase.auth.getUser();
    if (again.user?.id !== userId) return;

    // claim_push_device (SECURITY DEFINER) deactivates any other account's row
    // for this token and upserts ours as active, so a phone only receives the
    // signed-in account's pushes even if the previous account never signed out.
    const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
    // Not in the generated types until they are regenerated after the migration.
    const claim = await supabase.rpc(
      "claim_push_device" as never,
      { _token: token, _platform: platform } as never,
    );
    let error: { code?: string; message?: string } | null = claim.error;
    if (error && isMissingFunction(error)) {
      // Migration not applied yet: fall back to the owner-only upsert.
      const now = new Date().toISOString();
      ({ error } = await supabase
        .from("push_devices")
        .upsert(
          { user_id: userId, token, platform, is_active: true, last_seen_at: now, updated_at: now },
          { onConflict: "user_id,token" },
        ));
    }
    if (!error) writeStored({ token, userId });
  } catch {
    /* fail safely */
  } finally {
    inFlight = false;
  }
}

/** Deactivate this device's registration for the current account. Call before signOut(). */
export async function deactivateCurrentDevice(): Promise<void> {
  if (!isNativeApp()) return;
  const stored = readStored();
  if (!stored) return;
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId) {
      await (supabase as any)
        .from("push_devices")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("token", stored.token);
    }
  } catch {
    /* fail safely — never block logout */
  } finally {
    writeStored(null);
  }
}

/** Native permission state, or null outside the native app / on failure. */
export async function getPushPermissionState(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    return (await PushNotifications.checkPermissions()).receive;
  } catch {
    return null;
  }
}

/** Ask the OS for permission (shows the system prompt once), then reuse registration. */
export async function requestPushPermissionAndRegister(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const res = await PushNotifications.requestPermissions();
    if (res.receive === "granted") await registerCurrentDevice();
  } catch {
    /* fail safely */
  }
}

// ---------------------------------------------------------------------------
// Push tap handling (native app only). The push payload carries the existing
// notification_id; the signed-in shell resolves it with the same logic as the
// bell. A tap that arrives before the shell is ready (cold start) is held.
let pendingTapId: string | null = null;
let tapHandler: ((id: string) => void) | null = null;
let tapListenerStarted = false;

export function startPushTapListener(): void {
  if (tapListenerStarted || !isNativeApp()) return;
  tapListenerStarted = true;
  void import("@capacitor/push-notifications")
    .then(({ PushNotifications }) =>
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const raw = (action?.notification?.data as any)?.notification_id;
        const id = typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
        if (!id) return;
        if (tapHandler) tapHandler(id);
        else pendingTapId = id;
      }),
    )
    .catch(() => {
      tapListenerStarted = false;
    });
}

/** Register the shell's handler; delivers any tap held from a cold start. Returns cleanup. */
export function onPushTap(handler: (id: string) => void): () => void {
  tapHandler = handler;
  if (pendingTapId) {
    const id = pendingTapId;
    pendingTapId = null;
    handler(id);
  }
  return () => {
    if (tapHandler === handler) tapHandler = null;
  };
}
