import { useEffect } from "react";

declare global {
  interface Window {
    __SPLIT_THE_G_MAPS_LOADING__?: boolean;
  }
}

interface GoogleMapsScriptProps {
  apiKey: string;
  /** When true, ensures the Places library script is requested at most once per page lifetime. */
  active: boolean;
}

/**
 * Loads the Maps JavaScript API only when a route that uses PlacesAutocomplete is active.
 * Uses a window flag so client navigations away and back do not append duplicate script tags.
 */
export function GoogleMapsScript({ apiKey, active }: GoogleMapsScriptProps) {
  useEffect(() => {
    if (!active || !apiKey) return;
    if (typeof window === "undefined") return;
    if (window.google?.maps?.places) return;
    if (window.__SPLIT_THE_G_MAPS_LOADING__) return;
    window.__SPLIT_THE_G_MAPS_LOADING__ = true;

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async`;
    document.body.appendChild(script);
  }, [active, apiKey]);

  return null;
}
