/**
 * Routes that mount `PlacesAutocomplete` and need the Maps JS API in the document.
 * Keep the script out of other pages so navigation stays light.
 */
export function pathnameNeedsGoogleMapsScript(pathname: string): boolean {
  if (pathname === "/profile") return true;
  if (pathname.startsWith("/pour/")) return true;
  return false;
}
