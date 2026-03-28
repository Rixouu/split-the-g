const COMPETITION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when the route param is a canonical UUID (legacy / share links). */
export function isCompetitionUuidParam(raw: string): boolean {
  return COMPETITION_UUID_RE.test(raw.trim());
}

export function competitionDetailPath(c: {
  id: string;
  path_segment?: string | null;
}): string {
  const seg = c.path_segment?.trim();
  if (seg) return `/competitions/${encodeURIComponent(seg)}`;
  return `/competitions/${c.id}`;
}
