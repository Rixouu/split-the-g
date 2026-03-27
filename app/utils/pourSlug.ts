import { randomBytes } from "crypto";

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

/** URL-safe short id for /pour/{slug} (not a UUID shape). */
export function generatePourSlug(length = 8): string {
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[buf[i]! % 36]!;
  }
  return out;
}
