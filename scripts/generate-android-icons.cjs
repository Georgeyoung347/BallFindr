// Generates the Android adaptive launcher icon layers (108dp canvas) and the Android 12+
// launch icon (288dp canvas, B inside the 192dp circle) from resources/icon-foreground.png.
// Run after `@capacitor/assets generate` (which renders adaptive layers too small):
//   node scripts/generate-android-icons.cjs
const root = require("path").resolve(__dirname, "..");
const sharp = require('sharp');
const path = require('path');
const res = root + '/android/app/src/main/res';
const BG = '#0c0d0f';
const dens = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  // The B mark (with its glow) cropped from the 1024px transparent source.
  const mark = await sharp(root + '/resources/icon-foreground.png')
    .extract({ left: 200, top: 230, width: 625, height: 600 }).png().toBuffer();
  async function place(canvasPx, markWidthPx, out, background) {
    const w = Math.round(markWidthPx), h = Math.round(markWidthPx * 600 / 625);
    const m = await sharp(mark).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    await sharp({ create: { width: canvasPx, height: canvasPx, channels: 4,
        background: background || { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: m, left: Math.round((canvasPx - w) / 2), top: Math.round((canvasPx - h) / 2) }])
      .png({ compressionLevel: 9 }).toFile(out);
  }
  for (const [d, s] of Object.entries(dens)) {
    // Adaptive icon layers: 108dp canvas; B inside the 66dp safe zone (56% of canvas).
    const c = Math.round(108 * s);
    await place(c, c * 0.56, `${res}/mipmap-${d}/ic_launcher_foreground.png`);
    await sharp({ create: { width: c, height: c, channels: 4, background: BG } }).png().toFile(`${res}/mipmap-${d}/ic_launcher_background.png`);
    // Android 12+ launch icon without icon background: 288dp canvas, content must stay
    // inside the central 192dp circle -> B 120dp wide (diagonal ~166dp).
    const sc = Math.round(288 * s);
    require('fs').mkdirSync(`${res}/drawable-${d}`, { recursive: true });
    await place(sc, 120 * s, `${res}/drawable-${d}/splash_icon.png`);
    console.log(d, 'adaptive', c, 'splash_icon', sc);
  }
})();
