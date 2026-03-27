import sharp from "sharp";

export interface GPrediction {
  class: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

/**
 * Crop a tight JPEG around the best "G" detection (Roboflow: center x/y, w/h in pixels).
 * Returns raw base64 (no data URL prefix) for uploadImage().
 */
export async function cropGCloseupBase64(
  rawBase64: string,
  predictions: GPrediction[],
): Promise<string | null> {
  const gPreds = predictions.filter((p) => p.class === "G");
  if (gPreds.length === 0) return null;

  const best = gPreds.reduce((a, b) =>
    (b.confidence ?? 0) > (a.confidence ?? 0) ? b : a,
  );

  const buf = Buffer.from(rawBase64, "base64");
  const meta = await sharp(buf).metadata();
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  if (!iw || !ih) return null;

  const { x, y, width, height } = best;
  const padX = width * 0.18;
  const padY = height * 0.18;
  let left = Math.floor(x - width / 2 - padX);
  let top = Math.floor(y - height / 2 - padY);
  let w = Math.ceil(width + 2 * padX);
  let h = Math.ceil(height + 2 * padY);

  left = Math.max(0, left);
  top = Math.max(0, top);
  w = Math.min(w, iw - left);
  h = Math.min(h, ih - top);
  if (w < 8 || h < 8) return null;

  const out = await sharp(buf)
    .extract({ left, top, width: w, height: h })
    .jpeg({ quality: 88 })
    .toBuffer();

  return out.toString("base64");
}
