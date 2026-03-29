/**
 * Public nickname: 2–30 characters, Unicode letters (e.g. Irish á, ó), numbers,
 * spaces, hyphen, underscore. Used client-side before `public_profiles` upsert.
 */
export const NICKNAME_PATTERN =
  /^(?=.{2,30}$)[\p{L}\p{M}\p{N} _-]+$/u;

export function isValidNickname(trimmed: string): boolean {
  if (!trimmed) return true;
  return NICKNAME_PATTERN.test(trimmed);
}
