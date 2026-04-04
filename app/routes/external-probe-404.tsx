import type { LoaderFunctionArgs } from "react-router";

/**
 * Returns 404 for automated probes to legacy CMS URL shapes.
 * Keeps them from falling through to `:lang` (e.g. "wordpress" as a fake locale)
 * and triggering React Router "No route matches" noise in server logs.
 */
export async function loader(_args: LoaderFunctionArgs) {
  return new Response(null, {
    status: 404,
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}

export default function ExternalProbe404() {
  return null;
}
