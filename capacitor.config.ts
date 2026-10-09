import type { CapacitorConfig } from "@capacitor/cli";

// Native shell only: the app loads the live BallFindr website. Nothing from
// src/ is bundled. `native-shell/` holds just the offline fallback page.
const config: CapacitorConfig = {
  appId: "uk.co.ballfindr.app",
  appName: "BallFindr",
  webDir: "native-shell",
  backgroundColor: "#0c0d0f",
  server: {
    url: "https://ballfindr.co.uk",
    cleartext: false,
    // Keep in-app navigation restricted to BallFindr's own domains.
    allowNavigation: ["ballfindr.co.uk", "www.ballfindr.co.uk"],
    // Shown by the native shell when the live site can't load (e.g. offline).
    errorPath: "offline.html",
  },
};

export default config;
