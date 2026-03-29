import { useLoaderData } from "react-router";
import { AppLink } from "~/i18n/app-link";
import type { LoaderFunctionArgs } from "react-router";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_LIST_COLUMNS } from "~/utils/scoresListColumns";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";

type GuinnessNewsItem = {
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
};

type FeedRow = {
  id: string;
  slug?: string | null;
  username: string;
  pint_image_url: string;
  created_at: string;
  split_score: number;
  bar_name?: string | null;
  bar_address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  pint_price?: number | null;
};


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
  const rx = new RegExp(`<${tag}>([\s\S]*?)</${tag}>`, "i");
  const match = block.match(rx);
  return match?.[1]?.trim() ?? "";
}

async function fetchGuinnessThailandNews(limit = 6): Promise<GuinnessNewsItem[]> {
  const url =
    "https://news.google.com/rss/search?q=Guinness+Thailand+events&hl=en-US&gl=US&ceid=US:en";

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    return itemBlocks.slice(0, limit).map((block) => {
      const title = decodeXmlEntities(stripHtml(readTag(block, "title")));
      const link = decodeXmlEntities(readTag(block, "link"));
      const source = decodeXmlEntities(stripHtml(readTag(block, "source")));
      const publishedAt = readTag(block, "pubDate");

      return {
        title,
        link,
        source: source || undefined,
        publishedAt: publishedAt || undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function loader(_args: LoaderFunctionArgs) {
  const { data, error } = await supabase.rpc("feed_scores_recent", {
    p_limit: 48,
  });

  if (error) {
    const hint = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
    if (
      error.code === "42883" ||
      hint.includes("feed_scores_recent") ||
      hint.includes("function")
    ) {
      const fb = await supabase
        .from("scores")
        .select(SCORES_LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(48);
      if (fb.error) throw fb.error;
      return {
        items: (fb.data ?? []) as FeedRow[],
        guinnessNews: await fetchGuinnessThailandNews(),
      };
    }
    throw error;
  }

  return {
    items: (data ?? []) as FeedRow[],
    guinnessNews: await fetchGuinnessThailandNews(),
  };
}

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/feed", "feed");
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Feed() {
  const { t } = useI18n();
  const { items, guinnessNews } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={t("pages.feed.title")}
          description={t("pages.descriptions.feed")}
        >
          <AppLink to="/" viewTransition className={pageHeaderActionButtonClass}>
            {t("common.pour")}
          </AppLink>
        </PageHeader>

        <section className="mb-6 rounded-lg border border-guinness-gold/20 bg-guinness-brown/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-guinness-gold">
              {t("pages.feed.guinnessNewsTitle")}
            </h2>
            <span className="text-[10px] text-guinness-tan/60 sm:text-xs">
              {t("pages.feed.guinnessNewsLegal")}
            </span>
          </div>
          {guinnessNews.length === 0 ? (
            <p className="text-xs text-guinness-tan/70">{t("pages.feed.guinnessNewsEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {guinnessNews.map((item) => (
                <li key={`${item.link}-${item.publishedAt ?? ""}`}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block rounded-md border border-guinness-gold/15 bg-guinness-black/30 p-2 transition-colors hover:border-guinness-gold/35"
                  >
                    <p className="text-xs font-medium text-guinness-cream sm:text-sm">{item.title}</p>
                    <p className="mt-1 text-[10px] text-guinness-tan/60 sm:text-xs">
                      {[item.source, item.publishedAt].filter(Boolean).join(" • ")}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {items.length === 0 ? (
          <p className="type-meta rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-8 text-center text-guinness-tan/80">
            {t("pages.feed.empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((row) => (
              <li key={row.id} className="min-w-0">
                <AppLink
                  to={scorePourPathFromFields(row)}
                  prefetch="intent"
                  viewTransition
                  className="group block overflow-hidden rounded-lg border border-guinness-gold/15 bg-guinness-brown/30 transition-colors hover:border-guinness-gold/35"
                >
                  <div className="aspect-[3/4] bg-guinness-black/60">
                    {row.pint_image_url ? (
                      <img
                        src={row.pint_image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-guinness-tan/50">
                        {t("pages.feed.noImage")}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-2.5 sm:p-3">
                    <div className="flex items-start justify-between gap-1">
                      <span className="line-clamp-2 text-xs font-semibold text-guinness-cream sm:text-sm">
                        {flagEmojiFromIso2(row.country_code) ? (
                          <span
                            className="mr-1 inline-block shrink-0"
                            title={row.country_code?.trim().toUpperCase() ?? undefined}
                            aria-hidden
                          >
                            {flagEmojiFromIso2(row.country_code)}
                          </span>
                        ) : null}
                        {row.username}
                      </span>
                      <span className="shrink-0 tabular-nums text-sm font-semibold text-guinness-gold">
                        {Number(row.split_score).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-guinness-tan/55 sm:text-xs">
                      {formatWhen(row.created_at)}
                    </p>
                    {row.bar_name ? (
                      <p className="line-clamp-2 text-[10px] text-guinness-tan/45 sm:text-xs">
                        {row.bar_name}
                      </p>
                    ) : null}
                    {row.pint_price != null &&
                    Number.isFinite(Number(row.pint_price)) ? (
                      <p className="text-[10px] tabular-nums text-guinness-tan/50 sm:text-[11px]">
                        {Number(row.pint_price).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    ) : null}
                  </div>
                </AppLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
