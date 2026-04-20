export type AnalyticsConsentStatus = "accepted" | "rejected" | "unset";

const CONSENT_KEY = "stg_analytics_consent_v1";

export function getAnalyticsConsent(): AnalyticsConsentStatus {
  if (typeof window === "undefined") return "unset";
  const value = window.localStorage.getItem(CONSENT_KEY);
  if (value === "accepted" || value === "rejected") return value;
  return "unset";
}

export function setAnalyticsConsent(status: Exclude<AnalyticsConsentStatus, "unset">) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, status);
}
