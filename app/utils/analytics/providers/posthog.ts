import posthog from "posthog-js";
import type { AnalyticsEventName, AnalyticsPayloadFor } from "../events";

let posthogInitialized = false;

export function initPosthog(apiKey: string, host?: string) {
  if (typeof window === "undefined" || !apiKey || posthogInitialized) return;
  posthog.init(apiKey, {
    api_host: host || "https://us.i.posthog.com",
    capture_pageview: false,
    persistence: "localStorage+cookie",
  });
  posthogInitialized = true;
}

export function posthogTrack<TEvent extends AnalyticsEventName>(
  eventName: TEvent,
  payload: AnalyticsPayloadFor<TEvent>,
) {
  if (typeof window === "undefined" || !posthogInitialized) return;
  posthog.capture(eventName, payload);
}

export function posthogIdentify(userId: string) {
  if (typeof window === "undefined" || !posthogInitialized || !userId) return;
  posthog.identify(userId);
}

export function posthogReset() {
  if (typeof window === "undefined" || !posthogInitialized) return;
  posthog.reset();
}
