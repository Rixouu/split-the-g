import { stripLocalePrefix } from "~/i18n/paths";

/**
 * Routes that mount `PlacesAutocomplete` and need the Maps JS API in the document.
 * Keep the script out of other pages so navigation stays light.
 */
export function pathnameNeedsGoogleMapsScript(pathname: string): boolean {
  const p = stripLocalePrefix(pathname);
  if (p === "/profile" || p.startsWith("/profile/")) return true;
  if (p.startsWith("/pour/")) return true;
  if (p === "/competitions" || p.startsWith("/competitions/")) {
    return true;
  }
  return false;
}
