import { Analytics } from "@vercel/analytics/react";

/**
 * Vercel Web Analytics for React Router.
 * Loads only in the browser; no UI.
 */
export function VercelAnalytics() {
  return <Analytics />;
}
