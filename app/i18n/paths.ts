import type { SupportedLocale } from "./config";
import { DEFAULT_LOCALE, isSupportedLocale } from "./config";

/**
 * Path after locale prefix: `/en/feed` → `/feed`, `/en` → `/`, `/feed` → `/feed` (legacy).
 */
export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if (!isSupportedLocale(parts[0]!)) {
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  }
  const rest = parts.slice(1).join("/");
  return rest ? `/${rest}` : "/";
}

export function getLocaleFromPathname(pathname: string): SupportedLocale | null {
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && isSupportedLocale(first)) return first;
  return null;
}

/** Prefix app path (starts with /) with locale: `/feed` + en → `/en/feed` */
export function localizePath(path: string, lang: SupportedLocale): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return `/${lang}`;
  return `/${lang}${p}`;
}

/** Used when locale is unknown (e.g. root before redirect). */
export function localizePathDefault(path: string): string {
  return localizePath(path, DEFAULT_LOCALE);
}

const ROOT_REDIRECT_PATHS = new Set(["/collage", "/faq"]);

/**
 * After OAuth, Supabase often sends users to `/` (or the app redirects to `/:lang`).
 * Treat those as the “landing” path where we may restore a stored return URL.
 */
export function isOAuthReturnLandingPath(pathname: string): boolean {
  return stripLocalePrefix(pathname) === "/";
}

/**
 * Legacy stored paths may omit `/:lang` (e.g. `/profile/...`). Prefix with default
 * locale when needed. Leaves `/`, `/api/*`, `.well-known`, and root redirects alone.
 */
export function ensureLocalizedAppPath(fullPath: string): string {
  if (!fullPath.startsWith("/")) return fullPath;
  try {
    const u = new URL(fullPath, "http://local.invalid");
    const pathname = u.pathname;
    if (getLocaleFromPathname(pathname)) return fullPath;
    if (pathname.startsWith("/api/") || pathname.includes(".well-known")) {
      return fullPath;
    }
    if (ROOT_REDIRECT_PATHS.has(pathname)) return fullPath;
    const tail = `${u.search}${u.hash}`;
    if (pathname === "/" || pathname === "") {
      return `${localizePath("/", DEFAULT_LOCALE)}${tail}`;
    }
    return `${localizePath(pathname, DEFAULT_LOCALE)}${tail}`;
  } catch {
    return fullPath;
  }
}
