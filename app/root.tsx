import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import {
  AppNavigation,
  shouldShowAppNav,
} from "~/components/AppNavigation";
import { GlobalAuthToast } from "~/components/branded/GlobalAuthToast";
import { GlobalCompetitionPourToast } from "~/components/branded/GlobalCompetitionPourToast";
import { PostOAuthReturnRedirect } from "~/components/PostOAuthReturnRedirect";
import { GoogleMapsScript } from "~/components/GoogleMapsScript";
import { pathnameNeedsGoogleMapsScript } from "~/utils/google-maps-routes";

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

export async function loader() {
  return {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    GOOGLE_PLACES_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  };
}

export default function App() {
  const env = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const padForShellNav = shouldShowAppNav(pathname);
  const mapsKey = env.GOOGLE_PLACES_API_KEY ?? "";
  const mapsScriptActive =
    Boolean(mapsKey) && pathnameNeedsGoogleMapsScript(pathname);

  return (
    <html lang="en" suppressHydrationWarning>
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
        <div
          id="root"
          className={
            padForShellNav
              ? "min-h-dvh pb-[calc(11rem+env(safe-area-inset-bottom,0px))] pt-0 md:pb-0 md:pt-[3.75rem]"
              : "min-h-dvh"
          }
        >
          <Outlet />
        </div>
        <AppNavigation />
        <GlobalAuthToast />
        <GlobalCompetitionPourToast />
        <PostOAuthReturnRedirect />
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
              "if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }",
          }}
        />
        {/*
          Maps JS loads on /profile and /pour/* via GoogleMapsScript (see google-maps-routes).
          Pub detail pages use the Maps Embed API in an iframe (same VITE_GOOGLE_MAPS_API_KEY);
          enable "Maps Embed API" on that key. Places + JS API for pour/profile autocomplete.
        */}
        {mapsKey ? (
          <GoogleMapsScript apiKey={mapsKey} active={mapsScriptActive} />
        ) : null}
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <html lang="en" suppressHydrationWarning>
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
        <div id="root">
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
