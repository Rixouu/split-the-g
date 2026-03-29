const DEFAULT_SITE_URL = "https://www.split-the-g.app";
/** Raster OG image (WhatsApp / Facebook ignore most SVG `og:image` values). */
const DEFAULT_OG_IMAGE_PATH = "/og-default.png";
const DEFAULT_OG_WIDTH = "1200";
const DEFAULT_OG_HEIGHT = "630";

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
  /** Shown when `image` is set (e.g. pour photo). */
  imageAlt?: string;
  keywords?: string[];
  type?: "website" | "article";
  noindex?: boolean;
}

/** Absolute URL for meta tags (Open Graph requires absolute `og:image` / `og:url`). */
export function absoluteUrl(pathOrUrl: string): string {
  const raw = pathOrUrl.trim();
  if (!raw) return `${SITE_URL}/`;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${SITE_URL}${path}`;
}

export function seoMeta(config: SeoConfig) {
  const canonicalUrl = absoluteUrl(config.path ?? "/");
  const usesDefaultOgImage = !config.image;
  const imageUrl = absoluteUrl(config.image ?? DEFAULT_OG_IMAGE_PATH);
  const keywords = [
    "Split the G",
    "Guinness",
    "pint score",
    "beer challenge",
    ...(config.keywords ?? []),
  ];

  const imageAlt = usesDefaultOgImage
    ? "Split The G wordmark on a dark branded background"
    : (config.imageAlt ?? "Split the G pour preview");

  const meta: Array<
    | { title: string }
    | { name: string; content: string }
    | { property: string; content: string }
  > = [
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
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: config.title },
    { name: "twitter:description", content: config.description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: imageAlt },
  ];

  if (usesDefaultOgImage) {
    meta.push(
      { property: "og:image:width", content: DEFAULT_OG_WIDTH },
      { property: "og:image:height", content: DEFAULT_OG_HEIGHT },
      { property: "og:image:type", content: "image/png" },
    );
  }

  return meta;
}
