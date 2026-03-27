import type { Score } from "~/types/score";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True if `ref` is a score row UUID (used to choose id vs slug lookup). */
export function isScoreUuidRef(ref: string): boolean {
  return UUID_RE.test(ref.trim());
}

/** Canonical shareable path: /pour/{slug} when set, else /pour/{uuid}. */
export function scorePourPath(score: Pick<Score, "id" | "slug">): string {
  const s = score.slug?.trim();
  if (s) return `/pour/${encodeURIComponent(s)}`;
  return `/pour/${score.id}`;
}

/** Same as scorePourPath for rows that only have id + optional slug fields. */
export function scorePourPathFromFields(row: {
  id: string;
  slug?: string | null;
}): string {
  return scorePourPath({ id: row.id, slug: row.slug ?? undefined });
}
