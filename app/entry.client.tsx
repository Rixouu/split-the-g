import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// Make environment variables available in the browser
declare global {
  interface Window {
    ENV: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      GOOGLE_PLACES_API_KEY: string;
      GA_MEASUREMENT_ID: string;
      POSTHOG_KEY: string;
      POSTHOG_HOST: string;
    };
  }
}

// Expose environment variables to the browser
window.ENV = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  GOOGLE_PLACES_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  GA_MEASUREMENT_ID: import.meta.env.VITE_GA_MEASUREMENT_ID || "",
  POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY || "",
  POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST || "",
};

startTransition(() => {
  // Framework mode must hydrate `document` (not #root) so the data router context matches SSR.
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
}); 