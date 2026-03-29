import { ensureLocalizedAppPath } from "~/i18n/paths";

/** sessionStorage key — path to restore after Google OAuth when Supabase only redirects to site root. */
export const POST_OAUTH_RETURN_KEY = "stg_post_oauth_path";

const MAX_AGE_MS = 12 * 60 * 1000;

export function rememberPathBeforeGoogleOAuth(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname + window.location.search;
  sessionStorage.setItem(
    POST_OAUTH_RETURN_KEY,
    JSON.stringify({ path, at: Date.now() }),
  );
}

/** Use site root so `redirectTo` matches Supabase “Site URL” / allowed redirects; real path is restored client-side. */
export function googleOAuthRedirectToSiteRoot(): string {
  if (typeof window === "undefined") return "/";
  return new URL("/", window.location.origin).href;
}

export function clearPostOAuthReturnIfMatchesCurrentPath(
  pathname: string,
  search: string,
): void {
  if (typeof window === "undefined") return;
  const here = `${pathname}${search}`;
  const raw = sessionStorage.getItem(POST_OAUTH_RETURN_KEY);
  if (!raw) return;
  try {
    const { path } = JSON.parse(raw) as { path?: string };
    if (path === here) sessionStorage.removeItem(POST_OAUTH_RETURN_KEY);
  } catch {
    sessionStorage.removeItem(POST_OAUTH_RETURN_KEY);
  }
}

/**
 * If a post-OAuth path was stored and differs from `here`, remove it and return it for client navigation.
 * If it matches `here` (already on the right page), clear storage and return null.
 */
export function peekAndConsumePostOAuthReturnPath(here: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(POST_OAUTH_RETURN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { path?: string; at?: number };
    if (!parsed.path || typeof parsed.at !== "number") {
      sessionStorage.removeItem(POST_OAUTH_RETURN_KEY);
      return null;
    }
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      sessionStorage.removeItem(POST_OAUTH_RETURN_KEY);
      return null;
    }
    const rawTarget = parsed.path.startsWith("/")
      ? parsed.path
      : `/${parsed.path}`;
    const target = ensureLocalizedAppPath(rawTarget);
    sessionStorage.removeItem(POST_OAUTH_RETURN_KEY);
    if (target === here) return null;
    return target;
  } catch {
    sessionStorage.removeItem(POST_OAUTH_RETURN_KEY);
    return null;
  }
}
