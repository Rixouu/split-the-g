import type { AttributionContext } from "./events";

const FIRST_TOUCH_KEY = "stg_analytics_first_touch_v1";
const LAST_TOUCH_KEY = "stg_analytics_last_touch_v1";

function parseAttributionFromSearch(search: string): AttributionContext | null {
  const params = new URLSearchParams(search);
  const source = params.get("utm_source")?.trim() ?? "";
  const medium = params.get("utm_medium")?.trim() ?? "";
  const campaign = params.get("utm_campaign")?.trim() ?? "";
  const term = params.get("utm_term")?.trim() ?? "";
  const content = params.get("utm_content")?.trim() ?? "";
  const hasAny = Boolean(source || medium || campaign || term || content);
  if (!hasAny) return null;
  return {
    source: source || undefined,
    medium: medium || undefined,
    campaign: campaign || undefined,
    term: term || undefined,
    content: content || undefined,
  };
}

function safeRead(key: string): AttributionContext | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AttributionContext;
  } catch {
    return undefined;
  }
}

function safeWrite(key: string, value: AttributionContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function captureAttributionFromCurrentUrl(search: string) {
  if (typeof window === "undefined") return;
  const current = parseAttributionFromSearch(search);
  if (!current) return;
  const firstTouch = safeRead(FIRST_TOUCH_KEY);
  if (!firstTouch) safeWrite(FIRST_TOUCH_KEY, current);
  safeWrite(LAST_TOUCH_KEY, current);
}

export function getAttributionContext():
  | {
      firstTouch?: AttributionContext;
      lastTouch?: AttributionContext;
    }
  | undefined {
  if (typeof window === "undefined") return undefined;
  const firstTouch = safeRead(FIRST_TOUCH_KEY);
  const lastTouch = safeRead(LAST_TOUCH_KEY);
  if (!firstTouch && !lastTouch) return undefined;
  return { firstTouch, lastTouch };
}

export function getAttributionFields(): Record<string, string> {
  const attribution = getAttributionContext();
  const first = attribution?.firstTouch;
  const last = attribution?.lastTouch;
  const fields: Record<string, string> = {};
  if (first?.source) fields.first_touch_source = first.source;
  if (first?.medium) fields.first_touch_medium = first.medium;
  if (first?.campaign) fields.first_touch_campaign = first.campaign;
  if (last?.source) fields.last_touch_source = last.source;
  if (last?.medium) fields.last_touch_medium = last.medium;
  if (last?.campaign) fields.last_touch_campaign = last.campaign;
  return fields;
}
