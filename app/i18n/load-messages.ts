import type { SupportedLocale } from "./config";
import type { TranslateFn, TranslateVars } from "./translate";
import { interpolate } from "./translate";
import enCommon from "./messages/en/common.json";
import enNav from "./messages/en/nav.json";
import enSeo from "./messages/en/seo.json";
import enAuth from "./messages/en/auth.json";
import enLanguages from "./messages/en/languages.json";
import enToasts from "./messages/en/toasts.json";
import enErrors from "./messages/en/errors.json";
import enPagesHome from "./messages/en/pages/home.json";
import enPagesDescriptions from "./messages/en/pages/descriptions.json";
import enPagesFeed from "./messages/en/pages/feed.json";
import enPagesPubs from "./messages/en/pages/pubs.json";
import enPagesProfile from "./messages/en/pages/profile.json";
import enPagesCompetitions from "./messages/en/pages/competitions.json";
import enPagesCompetitionDetail from "./messages/en/pages/competitionDetail.json";
import enPagesScore from "./messages/en/pages/score.json";
import enPagesFaq from "./messages/en/pages/faq.json";
import enPagesLeaderboard from "./messages/en/pages/leaderboard.json";
import enPagesWall from "./messages/en/pages/wall.json";
import enPagesPubDetail from "./messages/en/pages/pubDetail.json";
import deBundle from "./messages/de";
import esBundle from "./messages/es";
import frBundle from "./messages/fr";
import itBundle from "./messages/it";
import jaBundle from "./messages/ja";
import thBundle from "./messages/th";

export type MessageBundle = {
  common: typeof enCommon;
  nav: typeof enNav;
  seo: typeof enSeo;
  auth: typeof enAuth;
  languages: typeof enLanguages;
  toasts: typeof enToasts;
  errors: typeof enErrors;
  pages: {
    home: typeof enPagesHome;
    descriptions: typeof enPagesDescriptions;
    feed: typeof enPagesFeed;
    pubs: typeof enPagesPubs;
    profile: typeof enPagesProfile;
    competitions: typeof enPagesCompetitions;
    competitionDetail: typeof enPagesCompetitionDetail;
    score: typeof enPagesScore;
    faq: typeof enPagesFaq;
    leaderboard: typeof enPagesLeaderboard;
    wall: typeof enPagesWall;
    pubDetail: typeof enPagesPubDetail;
  };
};

const enPages = {
  home: enPagesHome,
  descriptions: enPagesDescriptions,
  feed: enPagesFeed,
  pubs: enPagesPubs,
  profile: enPagesProfile,
  competitions: enPagesCompetitions,
  competitionDetail: enPagesCompetitionDetail,
  score: enPagesScore,
  faq: enPagesFaq,
  leaderboard: enPagesLeaderboard,
  wall: enPagesWall,
  pubDetail: enPagesPubDetail,
};

const enBundle: MessageBundle = {
  common: enCommon,
  nav: enNav,
  seo: enSeo,
  auth: enAuth,
  languages: enLanguages,
  toasts: enToasts,
  errors: enErrors,
  pages: enPages,
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
    th: thBundle as Record<string, unknown>,
    fr: frBundle as Record<string, unknown>,
    es: esBundle as Record<string, unknown>,
    de: deBundle as Record<string, unknown>,
    it: itBundle as Record<string, unknown>,
    ja: jaBundle as Record<string, unknown>,
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

export function getFlatMessages(lang: SupportedLocale): Record<string, string> {
  return flattenMessageBundle(getMessagesForLocale(lang));
}

export function createTranslator(lang: SupportedLocale): TranslateFn {
  const flat = getFlatMessages(lang);
  return (key: string, vars?: TranslateVars) =>
    interpolate(flat[key] ?? key, vars);
}

/** Build `t` for use inside I18nProvider (same as createTranslator but reuses flat map). */
export function makeTFromFlat(messages: Record<string, string>): TranslateFn {
  return (key: string, vars?: TranslateVars) =>
    interpolate(messages[key] ?? key, vars);
}
