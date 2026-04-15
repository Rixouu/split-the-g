import {
  Navigate,
  redirect,
  useLoaderData,
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
 * Mobile: stay on `/profile` (layout shows hub). Desktop-class clients: redirect
 * to Progress on the server so full navigations (Me link + OAuth return with
 * `reloadDocument`) never depend on a post-hydration `<Navigate />` — that
 * flow could race the router on production and surface a 404.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const raw = (params.lang ?? "").trim();
  if (!isSupportedLocale(raw)) return null;
  const lang = raw as SupportedLocale;
  if (requestLooksMobile(request)) {
    return { profileHub: true as const };
  }
  return redirect(localizePath("/profile/progress", lang));
}

export default function ProfileIndex() {
  const data = useLoaderData<typeof loader>();
  const params = useParams();
  const isDesktop = useIsDesktopMd();

  if (!data?.profileHub) return null;

  if (isDesktop) {
    return (
      <Navigate
        to={localizePath("/profile/progress", langFromParams(params))}
        replace
      />
    );
  }
  return null;
}
