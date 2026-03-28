import type { SupabaseClient } from "@supabase/supabase-js";

/** Decode a single `:barKey` route param (+ and % sequences). */
export function decodePubUrlSegment(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

/**
 * Canonical single path segment for `/pubs/...` share links.
 * Must stay in sync with `match_bar_pub_path_segment` in the database.
 */
export function barKeyToPubPathSegment(barKey: string): string {
  const lower = barKey.trim().toLowerCase();
  const slug = lower
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 0) return slug;
  return encodeURIComponent(lower);
}

/** True when the segment is a hyphenated lowercase slug (preferred share URL). */
export function isPrettyPubPathSegment(segment: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment);
}

export function pubDetailPath(barKey: string): string {
  return `/pubs/${barKeyToPubPathSegment(barKey)}`;
}

export async function resolveBarKeyFromPubPathSegment(
  client: SupabaseClient,
  rawSegment: string,
): Promise<string | null> {
  const decoded = decodePubUrlSegment(rawSegment).trim();
  if (!decoded) return null;

  const lowered = decoded.toLowerCase();
  let directQuery = await client
    .from("bar_pub_stats_mv")
    .select("bar_key")
    .eq("bar_key", lowered)
    .maybeSingle();
  if (directQuery.error) {
    directQuery = await client
      .from("bar_pub_stats")
      .select("bar_key")
      .eq("bar_key", lowered)
      .maybeSingle();
  }
  const direct = directQuery.data;

  if (direct?.bar_key) return direct.bar_key;

  const { data: slugKey, error } = await client.rpc(
    "match_bar_pub_path_segment",
    { p_segment: decoded },
  );
  if (error || slugKey == null) return null;
  return String(slugKey);
}
