/**
 * Native-feel glue for the Capacitor shell (iOS/Android app). The website stays
 * the single source of truth: everything here is a no-op in a normal browser
 * (Capacitor.isNativePlatform() is false), plugins are loaded on demand and
 * every failure is swallowed, so the site can never break because of it.
 *
 * initNativeUI() (wired once in routes/__root.tsx, so it runs on every page
 * including the landing page the shell loads first) does four things:
 *  1. hides the launch splash as soon as the site has rendered,
 *  2. keeps the status bar (+ Android gesture bar, iOS keyboard) in the site's
 *     light/dark theme by watching the `dark`/`light` class on <html>,
 *  3. makes the Android hardware back button close an open overlay, go back in
 *     history, or background the app from the first page,
 *  4. tags <html> with `capacitor-native` and `capacitor-<platform>` so
 *     styles.css can scope app-only tweaks (safe-area insets, tap highlight).
 * Haptic helpers are exported for other code to call from buttons/forms later.
 */
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { readTheme, THEME_CHANGE_EVENT, type BallFindrTheme } from "@/lib/theme";

type NativePlatform = "ios" | "android";

function nativePlatform(): NativePlatform | null {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    const platform = Capacitor.getPlatform();
    return platform === "ios" || platform === "android" ? platform : null;
  } catch {
    return null;
  }
}

function hasPlugin(name: string): boolean {
  try {
    return Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}

/** Runs a plugin call so that a synchronous throw becomes a rejection. */
function attempt(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return run();
  } catch (error) {
    return Promise.reject(error);
  }
}

let initialized = false;

/**
 * Idempotent; call from a client-side effect. Does nothing during SSR or on the
 * website, so it is safe to call unconditionally.
 */
export function initNativeUI(): void {
  if (initialized || typeof window === "undefined" || typeof document === "undefined") return;
  const platform = nativePlatform();
  if (!platform) return;
  initialized = true;

  try {
    document.documentElement.classList.add("capacitor-native", `capacitor-${platform}`);
  } catch {
    /* ignore */
  }
  void hideSplash();
  startThemeSync(platform);
  if (platform === "android") void startBackButton();
}

// ---------------------------------------------------------------------------
// Splash screen: the page is rendered by the time this runs, so hide it now
// instead of waiting for launchShowDuration (capacitor.config.ts).
async function hideSplash(): Promise<void> {
  if (!hasPlugin("SplashScreen")) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    /* launchAutoHide in capacitor.config.ts hides it anyway */
  }
}

// ---------------------------------------------------------------------------
// Theme sync. The site stores its theme as a `dark` / `light` class on <html>
// (lib/theme.ts); the system bars follow it. Capacitor's "Dark" style means
// light text for a dark background, so site dark -> Style.Dark.
let appliedTheme: BallFindrTheme | null = null;

async function applyBarsTheme(platform: NativePlatform, theme: BallFindrTheme): Promise<void> {
  if (appliedTheme === theme) return;
  appliedTheme = theme;
  const dark = theme === "dark";
  const jobs: Promise<unknown>[] = [];

  if (hasPlugin("StatusBar")) {
    jobs.push(
      attempt(async () => {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      }),
    );
  }
  if (hasPlugin("SystemBars")) {
    // Capacitor 8 core plugin: on Android this also styles the gesture /
    // navigation bar icons and is what Android re-applies after rotation or a
    // device dark-mode change, so it must hold the same value. The bars are
    // transparent (edge-to-edge), so their "colour" is the page background.
    jobs.push(
      attempt(() =>
        SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }),
      ),
    );
  }
  if (platform === "ios" && hasPlugin("Keyboard")) {
    jobs.push(
      attempt(async () => {
        const { Keyboard, KeyboardStyle } = await import("@capacitor/keyboard");
        await Keyboard.setStyle({ style: dark ? KeyboardStyle.Dark : KeyboardStyle.Light });
      }),
    );
  }

  const results = await Promise.allSettled(jobs);
  // Let the next theme change retry if any call failed.
  if (results.some((r) => r.status === "rejected")) appliedTheme = null;
}

function startThemeSync(platform: NativePlatform): void {
  const sync = () => void applyBarsTheme(platform, readTheme());
  sync();
  try {
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    // Also catches any other way the class can change (inline theme script, future code).
    new MutationObserver(sync).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Android hardware back button. Registering a listener disables Capacitor's
// default handling, so this owns the behaviour from here on:
//  1. an open dialog / sheet / menu closes (Radix layers dismiss on an Escape
//     keydown and mark it handled via preventDefault),
//  2. otherwise go back in browser history (TanStack Router follows popstate),
//  3. on the first page, background the app like Android does on a root task
//     (exitApp only if minimizing is unavailable).
async function startBackButton(): Promise<void> {
  if (!hasPlugin("App")) return;
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", ({ canGoBack }) => {
      if (dispatchEscape()) return;
      if (canGoBack) {
        window.history.back();
        return;
      }
      void App.minimizeApp().catch(() => App.exitApp().catch(() => undefined));
    });
  } catch {
    /* native default handling stays active */
  }
}

/** Sends an Escape keydown to the document; true when an overlay consumed it. */
function dispatchEscape(): boolean {
  try {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    });
    return !document.dispatchEvent(event);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Haptics helpers (native app only; silently do nothing on the website).
export type HapticImpact = "light" | "medium" | "heavy";
export type HapticNotice = "success" | "warning" | "error";

/** Short tap feedback for buttons and toggles. */
export async function hapticImpact(style: HapticImpact = "light"): Promise<void> {
  if (!nativePlatform() || !hasPlugin("Haptics")) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const styles = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: styles[style] });
  } catch {
    /* ignore */
  }
}

/** Outcome feedback, e.g. after a form submits or fails. */
export async function hapticNotification(type: HapticNotice = "success"): Promise<void> {
  if (!nativePlatform() || !hasPlugin("Haptics")) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    const types = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    } as const;
    await Haptics.notification({ type: types[type] });
  } catch {
    /* ignore */
  }
}

/** Subtle tick for a selection change (segmented controls, pickers). */
export async function hapticSelection(): Promise<void> {
  if (!nativePlatform() || !hasPlugin("Haptics")) return;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    /* ignore */
  }
}
