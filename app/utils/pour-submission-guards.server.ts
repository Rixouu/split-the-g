import { createHash } from "node:crypto";
import exifr from "exifr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PourGuardFailureCode =
  | "RATE_LIMITED"
  | "DUPLICATE_IMAGE"
  | "STALE_IMAGE_EXIF";

export interface PourGuardFailure {
  code: PourGuardFailureCode;
  message: string;
}

function envInt(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getPourRateLimitMaxPerHour(): number {
  return envInt("POUR_RATE_LIMIT_MAX_PER_HOUR", 5);
}

export function getPourExifMaxAgeMinutes(): number {
  return envInt("POUR_EXIF_MAX_AGE_MINUTES", 12);
}

export function sha256HexOfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256HexOfBase64Image(base64Payload: string): string {
  return sha256HexOfBuffer(Buffer.from(base64Payload, "base64"));
}

/**
 * If EXIF capture time is present and older than the window (or >2m in the future), reject.
 * Images with no usable EXIF date are allowed (many browsers and re-exports strip EXIF).
 */
export async function validatePourImageExifAge(
  imageBuffer: Buffer,
): Promise<PourGuardFailure | null> {
  const maxAgeMin = getPourExifMaxAgeMinutes();
  let taken: Date | undefined;
  try {
    const tags = await exifr.parse(imageBuffer, {
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
    });
    if (tags && typeof tags === "object") {
      const t =
        (tags as { DateTimeOriginal?: Date; CreateDate?: Date; ModifyDate?: Date })
          .DateTimeOriginal ??
        (tags as { CreateDate?: Date }).CreateDate ??
        (tags as { ModifyDate?: Date }).ModifyDate;
      if (t instanceof Date && !Number.isNaN(t.getTime())) taken = t;
    }
  } catch {
    return null;
  }

  if (!taken) return null;

  const now = Date.now();
  const ageMs = now - taken.getTime();
  const futureSkewMs = 2 * 60 * 1000;
  if (ageMs < -futureSkewMs) {
    return {
      code: "STALE_IMAGE_EXIF",
      message: "Image capture time is in the future.",
    };
  }
  if (ageMs > maxAgeMin * 60 * 1000) {
    return {
      code: "STALE_IMAGE_EXIF",
      message: `Image EXIF timestamp is older than ${maxAgeMin} minutes.`,
    };
  }
  return null;
}

export async function assertPourImageNotDuplicate(
  supabase: SupabaseClient,
  sha256: string,
): Promise<PourGuardFailure | null> {
  const { data, error } = await supabase
    .from("scores")
    .select("id")
    .eq("source_image_sha256", sha256)
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    const code = (error as { code?: string }).code;
    if (
      code === "42703" ||
      (msg.includes("source_image_sha256") && msg.includes("does not exist"))
    ) {
      return null;
    }
    throw error;
  }
  if (data?.id) {
    return {
      code: "DUPLICATE_IMAGE",
      message: "This exact pour photo was already submitted.",
    };
  }
  return null;
}

async function countSince(
  supabase: SupabaseClient,
  column: "ingest_ip" | "session_id" | "submitter_user_id",
  value: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", sinceIso);

  if (error) {
    const msg = error.message ?? "";
    const code = (error as { code?: string }).code;
    if (code === "42703" || msg.includes("does not exist")) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function assertPourSubmissionRateAllowed(
  supabase: SupabaseClient,
  opts: {
    ingestIp: string;
    sessionIdFromCookie: string | undefined;
    submitterUserId: string | undefined;
  },
): Promise<PourGuardFailure | null> {
  const max = getPourRateLimitMaxPerHour();
  const windowMs = 60 * 60 * 1000;
  const sinceIso = new Date(Date.now() - windowMs).toISOString();

  const checks: Promise<number>[] = [];
  if (opts.ingestIp && opts.ingestIp !== "unknown") {
    checks.push(countSince(supabase, "ingest_ip", opts.ingestIp, sinceIso));
  }
  if (opts.sessionIdFromCookie) {
    checks.push(
      countSince(supabase, "session_id", opts.sessionIdFromCookie, sinceIso),
    );
  }
  if (opts.submitterUserId) {
    checks.push(
      countSince(supabase, "submitter_user_id", opts.submitterUserId, sinceIso),
    );
  }

  const counts = await Promise.all(checks);
  const over = counts.some((c) => c >= max);
  if (over) {
    return {
      code: "RATE_LIMITED",
      message: `Maximum ${max} pour submissions per hour for this device or account.`,
    };
  }
  return null;
}
