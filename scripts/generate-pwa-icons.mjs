/**
 * Rasters public/app-icon-split-the-g.svg onto a solid black square for PWA / touch icons.
 *
 * Sharp/librsvg often rasterizes SVG "empty" space as white RGB even when the file has no
 * background rect; Chrome then shows a white plate in the install dialog. We inject a black
 * rectangle behind the paths and flatten so the output PNG is fully opaque black.
 *
 * Run after changing the SVG: npm run generate:pwa-icons
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const svgPath = join(publicDir, "app-icon-split-the-g.svg");

/** Matches site.webmanifest background_color / install UI expectation */
const BG_HEX = "#000000";

const outputs = [
  { size: 192, file: "web-app-manifest-192x192.png" },
  { size: 512, file: "web-app-manifest-512x512.png" },
  { size: 180, file: "apple-touch-icon.png" },
  { size: 96, file: "favicon-96x96.png" },
];

function svgWithBlackPlate(svgRaw) {
  return svgRaw.replace(
    /(<svg\b[^>]*>)/i,
    `$1<rect x="0" y="0" width="100%" height="100%" fill="${BG_HEX}"/>`,
  );
}

async function main() {
  const svgRaw = await readFile(svgPath, "utf8");
  const svgBuf = Buffer.from(svgWithBlackPlate(svgRaw));

  for (const { size, file } of outputs) {
    const outPath = join(publicDir, file);
    await sharp(svgBuf)
      .resize(size, size, {
        fit: "contain",
        position: "centre",
        background: BG_HEX,
      })
      .flatten({ background: BG_HEX })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Wrote ${outPath}`);
  }
}

await main();
