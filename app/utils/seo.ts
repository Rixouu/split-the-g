const DEFAULT_SITE_URL = "https://www.split-the-g.app";
const DEFAULT_OG_IMAGE_PATH = "/icon0.svg";

export const SITE_NAME = "Split The G";
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? DEFAULT_SITE_URL).replace(
  /\/$/,
  "",
);

export interface SeoConfig {
  title: string;
  description: string;
  path?: string;
  image?: string;
  keywords?: string[];
  type?: "website" | "article";
  noindex?: boolean;
}

export function absoluteUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

export function seoMeta(config: SeoConfig) {
  const canonicalUrl = absoluteUrl(config.path ?? "/");
  const imageUrl = absoluteUrl(config.image ?? DEFAULT_OG_IMAGE_PATH);
  const keywords = [
    "Split the G",
    "Guinness",
    "pint score",
    "beer challenge",
    ...(config.keywords ?? []),
  ];

  return [
    { title: `${config.title} | ${SITE_NAME}` },
    { name: "description", content: config.description },
    { name: "keywords", content: keywords.join(", ") },
    { name: "robots", content: config.noindex ? "noindex, nofollow" : "index, follow" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: config.type ?? "website" },
    { property: "og:title", content: config.title },
    { property: "og:description", content: config.description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: imageUrl },
    { property: "og:image:alt", content: "Split The G pint scoring preview" },
    { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: config.title },
    { name: "twitter:description", content: config.description },
    { name: "twitter:image", content: imageUrl },
  ];
}

