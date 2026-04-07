import { SpeedInsights, computeRoute } from "@vercel/speed-insights/react";
import { useLocation, useParams } from "react-router";

/**
 * Vercel Speed Insights for React Router (same route normalization as Remix adapter).
 * Loads only in the browser; no UI.
 */
export function VercelSpeedInsights() {
  const { pathname } = useLocation();
  const params = useParams();
  const pathParams: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) pathParams[key] = value;
  }
  const route = computeRoute(pathname, pathParams);
  return <SpeedInsights route={route} framework="react-router" />;
}
