/**
 * Builds public/og-default.png (1200×630) for Open Graph / WhatsApp previews.
 * SVG defaults are often ignored by link scrapers; raster + logo reads like pour shares.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const outPath = join(publicDir, "og-default.png");

const W = 1200;
const H = 630;

const bgSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0b0b"/>
      <stop offset="100%" stop-color="#1d180f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#2a2418" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0b0b0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="22" fill="none" stroke="#201B10" stroke-width="5"/>
  <rect x="36" y="36" width="${W - 72}" height="${H - 72}" rx="18" fill="none" stroke="#B38B2D" stroke-opacity="0.35" stroke-width="1.5"/>
</svg>
`.trim();

async function main() {
  const bgBuf = await sharp(Buffer.from(bgSvg)).png().toBuffer();

  const logoPath = join(publicDir, "logo-splittheg.svg");
  await readFile(logoPath);

  const logoBuf = await sharp(logoPath)
    .resize({ width: 780, withoutEnlargement: false })
    .png()
    .toBuffer();

  const { width: lw = 0, height: lh = 0 } = await sharp(logoBuf).metadata();
  const left = Math.max(0, Math.round((W - lw) / 2));
  const top = Math.max(0, Math.round((H - lh) / 2));

  await sharp(bgBuf)
    .composite([{ input: logoBuf, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`Wrote ${outPath}`);
}

await main();
