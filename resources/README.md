# Native app icons and splash screens

Source images for [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets)
("custom mode"). Everything under `ios/App/App/Assets.xcassets/`,
`android/app/src/main/res/mipmap-*/` and `android/app/src/main/res/drawable*/` is
generated from these files; edit the sources, not the outputs.

| File | Size | Used for |
| --- | --- | --- |
| `icon-only.png` | 1024x1024, opaque | iOS app icon (`AppIcon.appiconset`), Android legacy + round launcher icons (API 24-25) |
| `icon-foreground.png` | 1024x1024, transparent | Android adaptive icon foreground layer (`mipmap-*/ic_launcher_foreground.png`) |
| `icon-background.png` | 1024x1024, solid `#0c0d0f` | Android adaptive icon background layer (`mipmap-*/ic_launcher_background.png`) |
| `splash.png` | 2732x2732, opaque | iOS launch image (`Splash.imageset`, light), Android `drawable*/splash.png` |
| `splash-dark.png` | 2732x2732, opaque | iOS launch image (dark appearance), Android `drawable*night*/splash.png` |

## Design

- Brand colours: background `#0c0d0f`, accent `#a3f52d`, foreground `#fafafa`.
- Icons use the standalone "B" mark from `src/assets/ballfindr-owner-mark.png`, centred on
  the brand-dark background at 62% of the canvas height. That keeps the whole mark inside
  Apple's squircle mask and inside Android's 66dp safe circle, and it still reads at 48px.
- Splash screens use the full wordmark cropped from `src/assets/ballfindr-logo-transparent.png`,
  centred at 25% of the canvas width (about 54% of an iPhone's width once the square is
  aspect-filled to a portrait screen). Both the light and dark splash are brand-dark: the
  wordmark's white "Ball" vanishes on a light background, and the native shell's
  `backgroundColor` in `capacitor.config.ts` is `#0c0d0f`, so the launch image blends into
  the first web paint with no flash.
- The brand PNGs are only ~250px tall with a soft alpha channel (the white body is ~95%
  opaque). When the sources were built, alpha was stretched linearly (6 -> 0, 244 -> 255)
  before upscaling with Lanczos so the edges are crisp and the lime glow is preserved.

## Regenerate

```sh
npx capacitor-assets generate --ios --android --assetPath resources \
  --iconBackgroundColor '#0c0d0f' --iconBackgroundColorDark '#0c0d0f' \
  --splashBackgroundColor '#0c0d0f' --splashBackgroundColorDark '#0c0d0f'
```

The tool writes 7 iOS files (1024 icon + `Contents.json`, 3 light + 3 dark 2732x2732
launch images) and 74 Android files (6 densities x 4 launcher PNGs, 2 adaptive-icon XMLs,
13 light + 13 dark splash drawables). Then undo two side effects of the tool:

```sh
# 1. It re-serialises AndroidManifest.xml (whitespace only) even though nothing changed.
git checkout -- android/app/src/main/AndroidManifest.xml
# 2. It wraps the adaptive icon *background* in a 16.7% inset. A solid background must fill
#    the whole 108dp canvas or launcher parallax/long-press effects show a transparent ring.
#    The curated XML in git keeps the inset on the foreground only.
git checkout -- android/app/src/main/res/mipmap-anydpi-v26/
```

Notes:

- `icon-foreground.png` is rendered by the tool at launcher-icon sizes (48dp, not the 108dp
  adaptive canvas) and inset to the 72dp visible viewport, so the source maps onto that
  viewport. Keep the mark within the central ~90% of the file (the 66dp safe zone).
- The iOS 1024 icon is flattened with `--iconBackgroundColor`; keep `icon-only.png` opaque
  anyway, the App Store rejects icons with alpha.
- `android/app/src/main/res/values/ic_launcher_background.xml` holds the same brand colour
  as `icon-background.png`; keep them in sync if the background ever changes.
- The tool never deletes outputs it no longer references. If a generated filename changes,
  remove the stale file from the `.imageset`/`res` folder by hand.
- Android 12+ shows its own system splash (icon on `windowSplashScreenBackground`, see
  `values/styles.xml`) before the Capacitor splash drawable; the drawables here are what the
  `@capacitor/splash-screen` plugin and older Android versions display.

## Android launcher and launch-screen icons

`@capacitor/assets` renders the adaptive icon layers at 48dp launcher sizes (192px at
xxxhdpi), but adaptive layers are 108dp canvases (432px). Upscaled, the B looked blurry
and distorted, especially on the Android 12+ launch screen. After running the generator
above, run:

```sh
node scripts/generate-android-icons.cjs
```

It rewrites `mipmap-*/ic_launcher_foreground.png` and `ic_launcher_background.png` at
108dp sizes, and writes `drawable-*/splash_icon.png` (288dp, B inside the 192dp circle the
system shows), which `AppTheme.NoActionBarLaunch` uses as its launch icon.
