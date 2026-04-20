import { getAttributionContext, getAttributionFields } from "./attribution";
import type { AnalyticsEventName, AnalyticsPayloadFor } from "./events";
import { analyticsEventNames } from "./events";
import { ga4Track, initGa4 } from "./providers/ga4";
import {
  initPosthog,
  posthogIdentify,
  posthogReset,
  posthogTrack,
} from "./providers/posthog";

type AnalyticsConfig = {
  gaMeasurementId?: string;
  posthogKey?: string;
  posthogHost?: string;
  enabled: boolean;
};

let config: AnalyticsConfig = { enabled: false };

function withAttribution<TEvent extends AnalyticsEventName>(
  eventName: TEvent,
  payload: AnalyticsPayloadFor<TEvent>,
): AnalyticsPayloadFor<TEvent> {
  if (eventName !== analyticsEventNames.pageView) return payload;
  const attribution = getAttributionContext();
  if (!attribution) return payload;
  return {
    ...payload,
    attribution: attribution.lastTouch ?? attribution.firstTouch,
  } as AnalyticsPayloadFor<TEvent>;
}

export function initializeAnalytics(nextConfig: AnalyticsConfig) {
  config = nextConfig;
  if (!config.enabled) return;
  if (config.gaMeasurementId) initGa4(config.gaMeasurementId);
  if (config.posthogKey) initPosthog(config.posthogKey, config.posthogHost);
}

export function trackEvent<TEvent extends AnalyticsEventName>(
  eventName: TEvent,
  payload: AnalyticsPayloadFor<TEvent>,
) {
  if (!config.enabled) return;
  const payloadWithAttribution = withAttribution(eventName, payload);
  const payloadWithCommonAttribution = {
    ...payloadWithAttribution,
    ...getAttributionFields(),
  } as AnalyticsPayloadFor<TEvent>;
  ga4Track(eventName, payloadWithCommonAttribution);
  posthogTrack(eventName, payloadWithCommonAttribution);
}

export function trackPageView(payload: AnalyticsPayloadFor<"page_view">) {
  trackEvent(analyticsEventNames.pageView, payload);
}

export function identifyUser(userId: string) {
  if (!config.enabled) return;
  posthogIdentify(userId);
}

export function resetUser() {
  if (!config.enabled) return;
  posthogReset();
}
