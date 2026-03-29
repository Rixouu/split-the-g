import { seoMeta, type SeoConfig } from "~/utils/seo";
import { seoPath } from "~/utils/seo-path";
import { langFromParams } from "./lang-param";
import { createTranslator } from "./load-messages";
import type { TranslateVars } from "./translate";

function parseKeywordPipe(pipeJoined: string): string[] {
  return pipeJoined
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

const ROUTE_KEYS = [
  "root",
  "home",
  "feed",
  "pubs",
  "pubDetail",
  "competitions",
  "competitionDetail",
  "profile",
  "account",
  "progress",
  "expenses",
  "scores",
  "favorites",
  "friends",
  "faq",
  "leaderboard",
  "wall",
  "past24hr",
  "country",
  "scoreFallback",
  "scoreDetail",
] as const;

export type SeoRouteKey = (typeof ROUTE_KEYS)[number];

export function seoMetaForRoute(
  params: { lang?: string },
  pathWithoutLocale: string,
  routeKey: SeoRouteKey,
): ReturnType<typeof seoMeta> {
  const lang = langFromParams(params);
  const t = createTranslator(lang);
  const base = `seo.routes.${routeKey}`;
  const kwRaw = t(`${base}.keywords`);
  const keywords =
    kwRaw === `${base}.keywords` ? undefined : parseKeywordPipe(kwRaw);
  return seoMeta({
    title: t(`${base}.title`),
    description: t(`${base}.description`),
    path: seoPath(params, pathWithoutLocale),
    keywords,
  });
}

/** Dynamic score page meta when loader data is present. */
export function seoMetaForScoreDetail(
  params: { lang?: string },
  pathWithoutLocale: string,
  vars: TranslateVars,
  image?: string,
): ReturnType<typeof seoMeta> {
  const lang = langFromParams(params);
  const t = createTranslator(lang);
  const base = "seo.routes.scoreDetail";
  const kwRaw = t(`${base}.keywords`);
  const keywords =
    kwRaw === `${base}.keywords` ? undefined : parseKeywordPipe(kwRaw);
  const cfg: SeoConfig = {
    title: t(`${base}.title`, vars),
    description: t(`${base}.description`, vars),
    path: seoPath(params, pathWithoutLocale),
    image,
    imageAlt: t(`${base}.imageAlt`, vars),
    type: "article",
    keywords,
  };
  return seoMeta(cfg);
}
