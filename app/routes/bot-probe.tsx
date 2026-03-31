import type { LoaderFunctionArgs } from "react-router";

/**
 * Internet scanners commonly probe WordPress admin paths.
 * Return a plain 404 response so these requests do not trigger route-miss errors.
 */
export async function loader(_args: LoaderFunctionArgs) {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export default function BotProbe() {
  return null;
}
