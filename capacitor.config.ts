/// <reference types="@capacitor/app" />
/// <reference types="@capacitor/push-notifications" />
/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />
import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

// Native shell only: the app loads the live BallFindr website. Nothing from
// src/ is bundled. `native-shell/` holds just the offline fallback page.
//
// Everything below was checked against the installed plugin versions
// (node_modules/@capacitor/*/dist/esm/definitions.d.ts and @capacitor/cli
// declarations.d.ts). Unknown option names fail silently, so when upgrading a
// plugin re-check the names here. The runtime counterpart (hiding the splash,
// theme-aware status bar, Android back button) lives in src/lib/native-ui.ts
// and runs inside the webview only when the site is loaded by this shell.
const config: CapacitorConfig = {
  appId: "uk.co.ballfindr.app",
  appName: "BallFindr",
  webDir: "native-shell",
  // Webview background before the site paints and behind iOS overscroll:
  // the brand dark background, which is also the site's default theme.
  backgroundColor: "#0c0d0f",
  server: {
    url: "https://ballfindr.co.uk",
    cleartext: false,
    // Keep in-app navigation restricted to BallFindr's own domains.
    allowNavigation: ["ballfindr.co.uk", "www.ballfindr.co.uk"],
    // Shown by the native shell when the live site can't load (e.g. offline).
    errorPath: "offline.html",
  },
  ios: {
    // Safe areas are handled by the site's CSS (env(safe-area-inset-*) with
    // viewport-fit=cover), so WKWebView's scroll view must not add its own
    // insets on top of them or the header would get a double gap.
    contentInset: "never",
    // Long-press link previews are a browser affordance, not an app one.
    allowsLinkPreview: false,
  },
  android: {
    // The live site is HTTPS-only; never let http:// subresources load in the shell.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Brand background behind the splash image (iOS, and Android < 12).
      backgroundColor: "#0c0d0f",
      // Auto-hide stays ON so the splash can never get stuck if the remote site
      // is slow or fails to load (the offline page takes over instead).
      // 2s is a ceiling: native-ui.ts calls SplashScreen.hide() as soon as the
      // site has rendered, which is usually earlier.
      launchAutoHide: true,
      launchShowDuration: 2000,
      // Fade-out of the launch splash (Android 12+ splash API only; iOS uses
      // the fadeOutDuration passed to hide()).
      launchFadeOutDuration: 300,
      showSpinner: false,
    },
    StatusBar: {
      // Capacitor's "DARK" style = light icons/text for a dark background,
      // matching the default dark theme. native-ui.ts switches it to "LIGHT"
      // whenever the site is in its light theme.
      style: "DARK",
      // Overlay deliberately ON: Android 15+/16 (targetSdk 36) enforces
      // edge-to-edge so the bar overlays the webview there no matter what, and
      // iOS always overlays. Keeping it on everywhere gives one layout to test
      // and the site already pads its sticky headers and bottom nav with
      // env(safe-area-inset-*) (SiteHeader, AppShell, admin pages, toasts).
      overlaysWebView: true,
      // Only used if overlaysWebView is ever turned off on Android < 15 (an
      // overlaid bar is transparent and shows the page background instead).
      backgroundColor: "#0c0d0f",
    },
    SystemBars: {
      // Capacitor 8 core plugin that owns Android edge-to-edge/insets (it
      // replaced the old android.adjustMarginsForEdgeToEdge option).
      // "css": on WebView >= 140 with viewport-fit=cover the real insets reach
      // env(safe-area-inset-*) and are also injected as --safe-area-inset-*;
      // on older WebViews the webview is padded natively instead. Never
      // "disable", which would leave the page under the system bars.
      insetsHandling: "css",
      // The site always ships viewport-fit=cover (routes/__root.tsx); saying
      // so up front avoids a layout jump on first paint on Android.
      initialViewportFitValueHint: "cover",
      // Light content on the dark brand background at launch for both the
      // status bar and the Android gesture bar; native-ui.ts keeps it in sync
      // with the site theme afterwards.
      style: "DARK",
    },
    Keyboard: {
      // iOS: resize the whole WKWebView when the keyboard opens (the default,
      // made explicit). The site's fixed bottom nav (AppShell) and the message
      // composer (100dvh layout) then rise above the keyboard exactly like in
      // mobile Safari and a focused input near the bottom is never covered.
      // "body" would leave the fixed bottom nav hidden behind the keyboard and
      // "none" would cover the focused field.
      resize: KeyboardResize.Native,
      // No `style`: native-ui.ts sets the iOS keyboard appearance from the
      // site theme at runtime (dark/light) instead of a fixed value.
      // No `resizeOnFullScreen` (Android): SystemBars handles insets in
      // Capacitor 8 and warns when this is set.
      // No `autoBackdropColor`: "dom" cannot parse the site's oklch body
      // colour (falls back to white) and "auto" would always use the dark
      // brand colour, wrong in the light theme.
    },
    PushNotifications: {
      // How a push is shown while the app is in the foreground. On iOS "alert"
      // maps to banner + notification list; "badge" is iOS-only.
      presentationOptions: ["badge", "sound", "alert"],
    },
    // App plugin: the default Android back handling is kept until the site's
    // JS registers its own backButton listener (native-ui.ts), so the offline
    // page and the loading phase still get the native behaviour.
  },
};

export default config;
