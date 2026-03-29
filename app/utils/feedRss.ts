/**
 * External RSS for the feed page: Bangkok Post (Thailand) + optional Google News supplement.
 */

export interface FeedNewsItem {
  title: string;
  link: string;
  source: string;
  summary?: string;
  /** ISO 8601 when parseable */
  publishedAt: string;
}

const RSS_FETCH_UA =
  "Mozilla/5.0 (compatible; SplitTheGFeed/1.0; +https://splittheg.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BANGKOK_POST_RSS_FEEDS = [
  { url: "https://www.bangkokpost.com/rss/data/life.xml", source: "Bangkok Post — Life" },
  { url: "https://www.bangkokpost.com/rss/data/thailand.xml", source: "Bangkok Post — Thailand" },
  { url: "https://www.bangkokpost.com/rss/data/topstories.xml", source: "Bangkok Post — Top stories" },
] as const;

const MAX_NEWS_AGE_MS = 120 * 24 * 60 * 60 * 1000;
const FEED_NEWS_CACHE_TTL_MS = 5 * 60 * 1000;

type FeedNewsCacheEntry = {
  expiresAt: number;
  items: FeedNewsItem[];
};

const feedNewsCacheByLimit = new Map<number, FeedNewsCacheEntry>();

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function readTag(block: string, tag: string) {
  const rx = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(rx);
  return match?.[1]?.trim() ?? "";
}

function parseRssXml(xml: string, defaultSource: string): FeedNewsItem[] {
  if (!xml.includes("<rss") || !xml.includes("<item>")) return [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const out: FeedNewsItem[] = [];

  for (const block of itemBlocks) {
    const title = decodeXmlEntities(stripHtml(readTag(block, "title")));
    const link = decodeXmlEntities(readTag(block, "link"));
    const description = decodeXmlEntities(stripHtml(readTag(block, "description")));
    const pubRaw = readTag(block, "pubDate");
    if (!title || !link.startsWith("http")) continue;

    const d = pubRaw ? new Date(pubRaw) : new Date(NaN);
    const publishedAt = Number.isFinite(d.getTime())
      ? d.toISOString()
      : new Date().toISOString();

    out.push({
      title,
      link,
      source: defaultSource,
      summary: description || undefined,
      publishedAt,
    });
  }

  return out;
}

async function fetchRssUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": RSS_FETCH_UA,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return "";
  return response.text();
}

function mentionsGuinnessStout(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.includes("guinness")) return false;
  const isGwr =
    t.includes("guinness world record") ||
    t.includes("guinness world records");
  if (!isGwr) return true;
  return (
    t.includes("beer") ||
    t.includes("stout") ||
    t.includes("pub") ||
    t.includes("bar") ||
    t.includes("draught") ||
    t.includes("draft") ||
    t.includes("irish pub")
  );
}

function isRecentEnough(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= MAX_NEWS_AGE_MS;
}

function dedupeByLink(items: FeedNewsItem[]): FeedNewsItem[] {
  const seen = new Set<string>();
  const out: FeedNewsItem[] = [];
  for (const item of items) {
    const key = item.link.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchBangkokPostGuinnessNews(): Promise<FeedNewsItem[]> {
  const results = await Promise.all(
    BANGKOK_POST_RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const xml = await fetchRssUrl(url);
        return parseRssXml(xml, source);
      } catch {
        return [];
      }
    }),
  );

  const merged = results.flat();
  const filtered = merged.filter((item) => {
    const blob = `${item.title} ${item.summary ?? ""}`;
    return mentionsGuinnessStout(blob) && isRecentEnough(item.publishedAt);
  });

  filtered.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return dedupeByLink(filtered);
}

async function fetchGoogleNewsRssItems(
  searchQueryEncoded: string,
  take: number,
): Promise<FeedNewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${searchQueryEncoded}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": RSS_FETCH_UA,
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    const out: FeedNewsItem[] = [];
    for (const block of itemBlocks.slice(0, take * 3)) {
      const title = decodeXmlEntities(stripHtml(readTag(block, "title")));
      const link = decodeXmlEntities(readTag(block, "link"));
      const pubRaw = readTag(block, "pubDate");
      const sourceTag = decodeXmlEntities(stripHtml(readTag(block, "source")));
      if (!title || !link.startsWith("http")) continue;

      const d = pubRaw ? new Date(pubRaw) : new Date(NaN);
      const publishedAt = Number.isFinite(d.getTime())
        ? d.toISOString()
        : new Date().toISOString();

      const source = sourceTag || "Google News";

      out.push({
        title,
        link,
        source,
        publishedAt,
      });
    }

    return out;
  } catch {
    return [];
  }
}

function thailandHeadlineHint(item: FeedNewsItem): boolean {
  const blob = `${item.title} ${item.source}`.toLowerCase();
  return (
    blob.includes("thailand") ||
    blob.includes("bangkok") ||
    blob.includes("phuket") ||
    blob.includes("chiang mai") ||
    blob.includes("pattaya") ||
    blob.includes("thai ") ||
    blob.includes("bangkok post")
  );
}

/**
 * Thailand-focused Guinness / stout headlines: Bangkok Post RSS first, then Google News for Thailand/Bangkok.
 */
export async function fetchThailandGuinnessFeedNews(limit: number): Promise<FeedNewsItem[]> {
  const now = Date.now();
  const cached = feedNewsCacheByLimit.get(limit);
  if (cached && cached.expiresAt > now) {
    return cached.items;
  }

  const bp = await fetchBangkokPostGuinnessNews();
  let merged = [...bp];

  if (merged.length < Math.min(4, limit)) {
    const q1 = encodeURIComponent(
      '"Guinness" (beer OR stout) (Thailand OR Bangkok)',
    );
    const extra = await fetchGoogleNewsRssItems(q1, limit * 2);
    const filtered = extra.filter(
      (item) =>
        mentionsGuinnessStout(item.title) &&
        thailandHeadlineHint(item) &&
        isRecentEnough(item.publishedAt),
    );
    merged = dedupeByLink([...merged, ...filtered]);
  }

  if (merged.length < Math.min(3, limit)) {
    const q2 = encodeURIComponent("Guinness beer Thailand");
    const extra2 = await fetchGoogleNewsRssItems(q2, limit * 2);
    const filtered2 = extra2.filter(
      (item) =>
        mentionsGuinnessStout(item.title) &&
        isRecentEnough(item.publishedAt),
    );
    merged = dedupeByLink([...merged, ...filtered2]);
  }

  merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const items = merged.slice(0, limit);
  feedNewsCacheByLimit.set(limit, {
    expiresAt: now + FEED_NEWS_CACHE_TTL_MS,
    items,
  });
  return items;
}
