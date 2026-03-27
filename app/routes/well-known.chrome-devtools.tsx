import type { LoaderFunctionArgs } from "react-router";

/**
 * Chrome DevTools probes this URL; returning JSON silences router "no match" noise in dev.
 */
export async function loader(_args: LoaderFunctionArgs) {
  return Response.json({});
}

export default function WellKnownChromeDevtools() {
  return null;
}
