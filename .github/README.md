# GitHub Actions

## `workflows/mobile.yml` — Mobile

Runs on every push, on pull requests and on demand (`workflow_dispatch`). Superseded runs on the same ref are cancelled.
It is the only place the native apps are compiled; the development sandbox has no Xcode or Android SDK.

| Job              | Runner        | Proves                                                                                                                                   | Artifact                                     |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `web`            | ubuntu-latest | `tsc --noEmit`, `bun run build` (Cloudflare Workers) and `cap sync` for both platforms succeed. ESLint runs but is non-blocking for now. | none                                         |
| `edge-functions` | ubuntu-latest | `deno check`, `deno lint` and `deno test` pass for `supabase/functions/send-push`.                                                       | none                                         |
| `android`        | ubuntu-latest | `cap sync android` + `./gradlew assembleDebug` with JDK 21 / compileSdk 36 / AGP 8.13 / Gradle 8.14.3.                                   | `ballfindr-android-debug-apk` (14 days)      |
| `ios`            | macos-26      | `cap sync ios`, Swift package resolution and an unsigned `xcodebuild` for the iOS Simulator.                                             | `ballfindr-ios-simulator-app` (zip, 14 days) |

Notes

- ESLint (`bun run lint`) already fails on code that predates the workflow (mostly `prettier/prettier`), so the step
  uses `continue-on-error`. Drop that line once `bun run format` has been applied and the lint is clean.
- The Android job does not need `google-services.json`; `android/app/build.gradle` only applies the google-services
  plugin when the file exists, so the debug APK builds but push notifications are inert in it.
- The iOS job never signs. A device/App Store build needs an Apple team, certificates and a provisioning profile that
  are not in this repository.
- Bun is pinned (`BUN_VERSION`) to the version that wrote `bun.lock`; bump it together with the lockfile.
