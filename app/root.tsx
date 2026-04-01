import { lazy, Suspense } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import {
  AppNavigation,
  shouldShowAppNav,
} from "~/components/AppNavigation";
import { GoogleMapsScript } from "~/components/GoogleMapsScript";
import { pathnameNeedsGoogleMapsScript } from "~/utils/google-maps-routes";
import { htmlLangAttribute, DEFAULT_LOCALE } from "~/i18n/config";
import { createTranslator } from "~/i18n/load-messages";
import { getLocaleFromPathname } from "~/i18n/paths";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { hreflangDescriptors } from "~/utils/hreflang";
import { SITE_URL } from "~/utils/seo";

declare global {
  interface Window {
    ENV: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      GOOGLE_PLACES_API_KEY: string;
    };
  }
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap",
  },
  { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" },
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
  { rel: "stylesheet", href: stylesheet },
];

export function meta() {
  return seoMetaForRoute({ lang: DEFAULT_LOCALE }, "/", "root");
}

export async function loader({ request }: Route.LoaderArgs) {
  const requestOrigin = new URL(request.url).origin;
  return {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    GOOGLE_PLACES_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    WEB_PUSH_PUBLIC_KEY: import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY,
    SITE_ORIGIN: (import.meta.env.VITE_SITE_URL ?? requestOrigin ?? SITE_URL).replace(
      /\/$/,
      "",
    ),
  };
}

const GlobalAuthToast = lazy(async () => {
  const mod = await import("~/components/branded/GlobalAuthToast");
  return { default: mod.GlobalAuthToast };
});

const GlobalCompetitionPourToast = lazy(async () => {
  const mod = await import("~/components/branded/GlobalCompetitionPourToast");
  return { default: mod.GlobalCompetitionPourToast };
});

const PostOAuthReturnRedirect = lazy(async () => {
  const mod = await import("~/components/PostOAuthReturnRedirect");
  return { default: mod.PostOAuthReturnRedirect };
});

export default function App() {
  const env = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const padForShellNav = shouldShowAppNav(pathname);
  const documentLang =
    htmlLangAttribute(getLocaleFromPathname(pathname) ?? DEFAULT_LOCALE);
  const hreflangs = hreflangDescriptors(env.SITE_ORIGIN, pathname);
  const mapsKey = env.GOOGLE_PLACES_API_KEY ?? "";
  const mapsScriptActive =
    Boolean(mapsKey) && pathnameNeedsGoogleMapsScript(pathname);
  const isNavigating = navigation.state !== "idle";

  return (
    <html lang={documentLang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#050608" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Split the G" />
        <Meta />
        <link rel="canonical" href={`${env.SITE_ORIGIN}${pathname || "/"}`} />
        {hreflangs.map(({ hrefLang, href }) => (
          <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
        ))}
        <Links />
      </head>
      <body suppressHydrationWarning>
        <RoutePendingIndicator isActive={isNavigating} />
        <div
          id="root"
          className={
            padForShellNav
              ? "stg-route-surface min-h-dvh pb-[calc(11rem+env(safe-area-inset-bottom,0px))] pt-0 md:pb-0 md:pt-[3.75rem]"
              : "stg-route-surface min-h-dvh"
          }
        >
          <Outlet />
        </div>
        <AppNavigation />
        <Suspense fallback={null}>
          <GlobalAuthToast />
          <GlobalCompetitionPourToast />
          <PostOAuthReturnRedirect />
        </Suspense>
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(env)}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if ('serviceWorker' in navigator) { function stgRegisterSw(){navigator.serviceWorker.register('/sw.js').catch(function(){});} if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', stgRegisterSw); else stgRegisterSw(); }",
          }}
        />
        {/*
          Maps JS loads on /profile, /pour/*, and /competitions via GoogleMapsScript (see google-maps-routes).
          Pub detail pages use the Maps Embed API in an iframe (same VITE_GOOGLE_MAPS_API_KEY);
          enable "Maps Embed API" on that key. Places + JS API for pour/profile/competition autocomplete.
        */}
        {mapsKey ? (
          <GoogleMapsScript apiKey={mapsKey} active={mapsScriptActive} />
        ) : null}
      </body>
    </html>
  );
}

function RoutePendingIndicator({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] transition-opacity duration-150 ${
        isActive ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-1 w-full overflow-hidden bg-guinness-gold/10">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-guinness-gold shadow-[0_0_18px_rgba(212,175,55,0.55)]" />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const t = createTranslator(DEFAULT_LOCALE);
  let message = t("errors.boundaryTitle");
  let details = t("errors.boundaryUnexpected");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : t("errors.boundaryError");
    details =
      error.status === 404
        ? t("errors.boundary404")
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <html lang={htmlLangAttribute(DEFAULT_LOCALE)} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#050608" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Split the G" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <div id="root" className="stg-route-surface min-h-dvh">
          <main className="pt-16 p-4 container mx-auto text-guinness-cream">
            <h1 className="type-display text-3xl">{message}</h1>
            <p className="type-body-muted mt-2">{details}</p>
            {stack && (
              <pre className="w-full p-4 overflow-x-auto">
                <code>{stack}</code>
              </pre>
            )}
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
