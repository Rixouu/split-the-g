import type { AnalyticsEventName, AnalyticsPayloadFor } from "../events";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let gaInitialized = false;

export function initGa4(measurementId: string) {
  if (typeof window === "undefined" || !measurementId || gaInitialized) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
  gaInitialized = true;
}

export function ga4Track<TEvent extends AnalyticsEventName>(
  eventName: TEvent,
  payload: AnalyticsPayloadFor<TEvent>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, payload);
}
