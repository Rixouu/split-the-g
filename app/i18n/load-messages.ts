import type { SupportedLocale } from "./config";
import enCommon from "./messages/en/common.json";
import enNav from "./messages/en/nav.json";
import enSeo from "./messages/en/seo.json";
import deOverrides from "./messages/de/overrides.json";
import esOverrides from "./messages/es/overrides.json";
import frOverrides from "./messages/fr/overrides.json";
import itOverrides from "./messages/it/overrides.json";
import jaOverrides from "./messages/ja/overrides.json";
import thOverrides from "./messages/th/overrides.json";

export type MessageBundle = {
  common: typeof enCommon;
  nav: typeof enNav;
  seo: typeof enSeo;
};

const enBundle: MessageBundle = {
  common: enCommon,
  nav: enNav,
  seo: enSeo,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    const prev = out[k];
    if (isRecord(v) && isRecord(prev)) {
      out[k] = deepMerge(prev, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function mergeBundle(over: Record<string, unknown>): MessageBundle {
  const merged = deepMerge(
    enBundle as unknown as Record<string, unknown>,
    over,
  );
  return merged as unknown as MessageBundle;
}

const OVERRIDE_BY_LOCALE: Partial<Record<SupportedLocale, Record<string, unknown>>> =
  {
    th: thOverrides as Record<string, unknown>,
    fr: frOverrides as Record<string, unknown>,
    es: esOverrides as Record<string, unknown>,
    de: deOverrides as Record<string, unknown>,
    it: itOverrides as Record<string, unknown>,
    ja: jaOverrides as Record<string, unknown>,
  };

export function getMessagesForLocale(lang: SupportedLocale): MessageBundle {
  if (lang === "en") return enBundle;
  const over = OVERRIDE_BY_LOCALE[lang];
  if (!over) return enBundle;
  return mergeBundle(over);
}

/** Flat dot keys: `nav.feed` — for fast `t()` lookup. */
export function flattenMessageBundle(bundle: MessageBundle): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (prefix: string, node: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") {
        out[key] = v;
      } else if (isRecord(v)) {
        walk(key, v);
      }
    }
  };
  walk("", bundle as unknown as Record<string, unknown>);
  return out;
}
