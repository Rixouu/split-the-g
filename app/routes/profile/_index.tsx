import {
  Navigate,
  redirect,
  useLoaderData,
  useLocation,
  useParams,
  type LoaderFunctionArgs,
} from "react-router";
import { isSupportedLocale, type SupportedLocale } from "~/i18n/config";
import { langFromParams } from "~/i18n/lang-param";
import { localizePath } from "~/i18n/paths";
import { useIsDesktopMd } from "~/utils/useDesktopMd";

/**
 * Prefer `Sec-CH-UA-Mobile` (Chromium) with a small UA fallback. This is only
 * used to decide the `/profile` landing: real `md` breakpoint is still
 * `useIsDesktopMd` on the client for edge cases (e.g. mobile UA + wide window).
 */
function requestLooksMobile(request: Request): boolean {
  const ch = request.headers.get("sec-ch-ua-mobile");
  if (ch === "?1") return true;
  if (ch === "?0") return false;
  const ua = request.headers.get("user-agent") ?? "";
  return /\bMobile\b|Android.*Mobile|iPhone|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(
    ua,
  );
}

/**
 * Server redirects must keep the query string. Supabase PKCE returns
 * `?code=...` (and `error` / `error_description`) on the configured redirect URI.
 * Dropping it breaks session exchange and can surface as broken post-login
 * navigation (including route errors that look like 404).
 *
 * Hash fragments (`#access_token=...`) are never visible to this loader; use
 * Site URL at `/` or `/:lang` for implicit flows, or ensure redirect URIs are
 * not rewritten away before the client reads the hash.
 */
function redirectProfileDesktop(request: Request, lang: SupportedLocale) {
  const path = localizePath("/profile/account", lang);
  const search = new URL(request.url).search;
  return redirect(`${path}${search}`);
}

/**
 * Mobile: stay on `/profile` (layout shows hub). Desktop-class clients: redirect
 * to Account on the server so full navigations (Me link + `reloadDocument`)
 * do not rely only on a post-hydration `<Navigate />`.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const raw = (params.lang ?? "").trim();
  if (!isSupportedLocale(raw)) return null;
  const lang = raw as SupportedLocale;
  if (requestLooksMobile(request)) {
    return { profileHub: true as const };
  }
  return redirectProfileDesktop(request, lang);
}

export default function ProfileIndex() {
  const data = useLoaderData<typeof loader>();
  const params = useParams();
  const { search } = useLocation();
  const isDesktop = useIsDesktopMd();

  if (!data?.profileHub) return null;

  if (isDesktop) {
    return (
      <Navigate
        to={`${localizePath("/profile/account", langFromParams(params))}${search}`}
        replace
      />
    );
  }
  return null;
}
