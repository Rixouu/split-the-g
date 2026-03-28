/**
 * Routes that mount `PlacesAutocomplete` and need the Maps JS API in the document.
 * Keep the script out of other pages so navigation stays light.
 */
export function pathnameNeedsGoogleMapsScript(pathname: string): boolean {
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  if (pathname.startsWith("/pour/")) return true;
  if (pathname === "/competitions" || pathname.startsWith("/competitions/")) {
    return true;
  }
  return false;
}
