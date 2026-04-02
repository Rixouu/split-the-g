import { formatDistanceToNow } from "date-fns";
import { useCallback, useState } from "react";
import { useLoaderData } from "react-router";
import { AppLink } from "~/i18n/app-link";
import type { LoaderFunctionArgs } from "react-router";
import { FeedNewsDrawer } from "~/components/feed/FeedNewsDrawer";
import { FeedSocialRail } from "~/components/feed/FeedSocialRail";
import { AdSlotBanner } from "~/components/ad-slot-banner";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageHeaderSecondaryActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import type { FeedNewsItem } from "~/utils/feedRss";
import { fetchThailandGuinnessFeedNews } from "~/utils/feedRss";
import { pubDetailPath } from "~/utils/pubPath";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_LIST_COLUMNS } from "~/utils/scoresListColumns";
import { supabase } from "~/utils/supabase";

const FEED_STROKE = "border-[#322914]";

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

async function loadFeedScores(): Promise<{ items: FeedRow[] }> {
  const { data, error } = await supabase.rpc("feed_scores_recent", {
    p_limit: 36,
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
        .limit(36);
      if (fb.error) throw fb.error;
      return { items: (fb.data ?? []) as FeedRow[] };
    }
    throw error;
  }

  return { items: (data ?? []) as FeedRow[] };
}

export async function loader(_args: LoaderFunctionArgs) {
  const [itemsPayload, news] = await Promise.all([
    loadFeedScores(),
    fetchThailandGuinnessFeedNews(10),
  ]);

  return {
    items: itemsPayload.items,
    news,
  };
}

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/feed", "feed");
}

/* ─── helpers ─── */

function formatPourWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNewsRelative(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function barKeyFromName(name: string | null | undefined): string | null {
  const n = name?.trim();
  if (!n) return null;
  return n.toLowerCase();
}

/* ─── news items ─── */

function NewsSidebarCard({
  item,
  onClick,
}: {
  item: FeedNewsItem;
  onClick: () => void;
}) {
  const rel = formatNewsRelative(item.publishedAt);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left"
    >
      <div
        className={`rounded-xl border ${FEED_STROKE} bg-guinness-brown/20 px-3.5 py-3 transition-colors hover:border-guinness-gold/25 hover:bg-guinness-brown/35`}
      >
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-guinness-gold/70">
          {item.source}
        </span>
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-guinness-cream group-hover:text-guinness-tan">
          {item.title}
        </p>
        {rel ? (
          <span className="mt-1.5 block text-[10px] text-guinness-tan/50">
            {rel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function NewsInlineCard({
  item,
  onClick,
}: {
  item: FeedNewsItem;
  onClick: () => void;
}) {
  const rel = formatNewsRelative(item.publishedAt);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group col-span-full w-full text-left"
    >
      <div
        className={`rounded-xl border ${FEED_STROKE} bg-guinness-brown/20 px-4 py-3 transition-colors hover:border-guinness-gold/25 hover:bg-guinness-brown/35`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-guinness-gold/70">
            {item.source}
          </span>
          {rel ? (
            <span className="ml-auto shrink-0 text-[10px] text-guinness-tan/50">
              {rel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-guinness-cream group-hover:text-guinness-tan">
          {item.title}
        </p>
      </div>
    </button>
  );
}

/* ─── pour card ─── */

function PourCard({
  row,
  noImageLabel,
}: {
  row: FeedRow;
  noImageLabel: string;
}) {
  const bk = barKeyFromName(row.bar_name);
  const flag = flagEmojiFromIso2(row.country_code);

  return (
    <article
      className={`group overflow-hidden rounded-2xl border ${FEED_STROKE} bg-gradient-to-br from-guinness-brown/45 via-guinness-brown/30 to-guinness-black/40 shadow-[inset_0_1px_0_rgba(212,175,55,0.04)] transition-colors hover:border-guinness-gold/25`}
    >
      <AppLink
        to={scorePourPathFromFields(row)}
        prefetch="intent"
        viewTransition
        className="block"
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          {row.pint_image_url ? (
            <img
              src={row.pint_image_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-guinness-brown/30 text-xs text-guinness-tan/40">
              {noImageLabel}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-12">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-guinness-cream">
                  {flag ? (
                    <span className="mr-1" aria-hidden>{flag}</span>
                  ) : null}
                  {row.username}
                </span>
                <span className="block text-[11px] text-guinness-tan/65">
                  {formatPourWhen(row.created_at)}
                </span>
              </div>
              <span className="shrink-0 rounded-lg bg-guinness-gold px-2 py-0.5 text-sm font-bold tabular-nums text-guinness-black">
                {Number(row.split_score).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </AppLink>
      {row.bar_name ? (
        <div className={`border-t ${FEED_STROKE} px-3 py-2`}>
          {bk ? (
            <AppLink
              to={pubDetailPath(bk)}
              prefetch="intent"
              viewTransition
              className="line-clamp-1 text-[12px] font-medium text-guinness-gold/85 transition-colors hover:text-guinness-gold"
            >
              {row.bar_name}
            </AppLink>
          ) : (
            <p className="line-clamp-1 text-[12px] text-guinness-tan/50">
              {row.bar_name}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

/* ─── main component ─── */

export default function Feed() {
  const { t } = useI18n();
  const { items, news } = useLoaderData<typeof loader>();
  const [drawerItem, setDrawerItem] = useState<FeedNewsItem | null>(null);

  const openDrawer = useCallback((item: FeedNewsItem) => {
    setDrawerItem(item);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerItem(null);
  }, []);

  const inlineNewsSlots = new Map<number, FeedNewsItem>();
  if (news.length > 0) {
    const positions = [4, 12, 22];
    for (let i = 0; i < Math.min(news.length, positions.length); i++) {
      if (positions[i] < items.length) {
        inlineNewsSlots.set(positions[i], news[i]);
      }
    }
  }

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
          <AppLink
            to="/pubs"
            viewTransition
            className={pageHeaderSecondaryActionButtonClass}
          >
            {t("pages.feed.headerBrowsePubs")}
          </AppLink>
        </PageHeader>

        {/* ─── two-column layout on desktop ─── */}
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 xl:grid-cols-[1fr_360px]">
          {/* ─── main feed column ─── */}
          <div>
            <AdSlotBanner
              className="mb-4"
              ariaLabel={t("pages.feed.advertiseBannerAria")}
              slotLabel={t("pages.feed.advertiseBannerSlotLabel")}
              title={t("pages.feed.advertiseBannerTitle")}
              body={t("pages.feed.advertiseBannerBody")}
              ctaHref="mailto:jonathan.rycx@gmail.com?subject=Split%20the%20G%20%E2%80%94%20feed%20advertising"
              ctaLabel={t("pages.feed.advertiseBannerCta")}
            />

            <h2 className="type-card-title mb-4">
              {t("pages.feed.poursSectionTitle")}
            </h2>

            {items.length === 0 ? (
              <p
                className={`type-meta rounded-2xl border ${FEED_STROKE} bg-guinness-brown/25 px-6 py-12 text-center`}
              >
                {t("pages.feed.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
                {items.map((row, idx) => (
                  <PourCardWithInlineNews
                    key={row.id}
                    row={row}
                    idx={idx}
                    noImageLabel={t("pages.feed.noImage")}
                    inlineItem={inlineNewsSlots.get(idx) ?? null}
                    onNewsClick={openDrawer}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─── sidebar (desktop only) ─── */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              {/* social section */}
              <section
                className={`rounded-2xl border ${FEED_STROKE} bg-guinness-brown/25 p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.05)]`}
              >
                <h2 className="type-card-title mb-3">
                  {t("pages.feed.socialSectionLabel")}
                </h2>
                <FeedSocialRail />
              </section>

              {/* news section */}
              {news.length > 0 ? (
                <section
                  className={`rounded-2xl border ${FEED_STROKE} bg-guinness-brown/25 p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.05)]`}
                >
                  <h2 className="type-card-title mb-3">
                    {t("pages.feed.newsStripTitle")}
                  </h2>
                  <div className="space-y-2">
                    {news.map((item) => (
                      <NewsSidebarCard
                        key={item.link}
                        item={item}
                        onClick={() => openDrawer(item)}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-guinness-tan/40">
                    {t("pages.feed.feedAttribution")}
                  </p>
                </section>
              ) : null}
            </div>
          </aside>
        </div>

        {/* ─── mobile-only social + news ─── */}
        <div className="mt-8 space-y-8 lg:hidden">
          <section>
            <h2 className="type-card-title mb-3">
              {t("pages.feed.socialSectionLabel")}
            </h2>
            <div
              className={`rounded-2xl border ${FEED_STROKE} bg-guinness-brown/25 p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.05)]`}
            >
              <FeedSocialRail />
            </div>
          </section>

          {news.length > 0 ? (
            <section>
              <h2 className="type-card-title mb-3">
                {t("pages.feed.newsStripTitle")}
              </h2>
              <div
                className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
              >
                {news.map((item) => (
                  <button
                    key={item.link}
                    type="button"
                    onClick={() => openDrawer(item)}
                    className={`group flex min-w-[72vw] shrink-0 snap-start flex-col rounded-xl border ${FEED_STROKE} bg-guinness-brown/25 p-3.5 text-left transition-colors hover:border-guinness-gold/25 hover:bg-guinness-brown/40 sm:min-w-[260px]`}
                  >
                    <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-guinness-gold/70">
                      {item.source}
                    </span>
                    <p className="line-clamp-2 flex-1 text-[13px] font-medium leading-snug text-guinness-cream group-hover:text-guinness-tan">
                      {item.title}
                    </p>
                    <span className="mt-2 text-[10px] text-guinness-tan/50">
                      {formatNewsRelative(item.publishedAt)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-guinness-tan/40">
                {t("pages.feed.feedAttribution")}
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <FeedNewsDrawer item={drawerItem} onClose={closeDrawer} />
    </main>
  );
}

function PourCardWithInlineNews({
  row,
  idx: _idx,
  noImageLabel,
  inlineItem,
  onNewsClick,
}: {
  row: FeedRow;
  idx: number;
  noImageLabel: string;
  inlineItem: FeedNewsItem | null;
  onNewsClick: (item: FeedNewsItem) => void;
}) {
  return (
    <>
      {inlineItem ? (
        <NewsInlineCard
          item={inlineItem}
          onClick={() => onNewsClick(inlineItem)}
        />
      ) : null}
      <PourCard row={row} noImageLabel={noImageLabel} />
    </>
  );
}
