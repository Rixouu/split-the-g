import { useLoaderData } from "react-router";
import { AppLink } from "~/i18n/app-link";
import type { LoaderFunctionArgs } from "react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  EndPageNewPourFooter,
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  pubsPageDescription,
} from "~/components/PageHeader";
import { routeViewTransitionLinkProps } from "~/utils/routeViewTransition";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { pubDetailPath } from "~/utils/pubPath";
import { NATIVE_SELECT_APPEARANCE_CLASS } from "~/utils/native-select-classes";
import { seoMeta } from "~/utils/seo";
import { seoPath } from "~/utils/seo-path";
import {
  PubVenueCard,
  PUB_VENUE_CARD_STROKE as PUB_LIST_STROKE,
  pubVenueCardActionMutedClass,
  pubVenueCardActionOutlineClass,
  pubVenueCardActionSavedClass,
} from "~/components/pub-venue-card";

export type BarStat = {
  bar_key: string;
  display_name: string;
  sample_address: string | null;
  /** Aggregated from scores when pourers chose a Places suggestion. */
  google_place_id?: string | null;
  avg_pour_rating: number | null;
  rating_count: number;
  submission_count: number;
};

export function meta({ params }: { params: { lang?: string } }) {
  return seoMeta({
    title: "Pubs",
    description: "Find pubs, compare average pour ratings, and open each pub wall.",
    path: seoPath(params, "/pubs"),
    keywords: ["guinness pubs", "pub leaderboard", "split the g pubs"],
  });
}

function aggregateFromScores(
  rows: {
    bar_name: string | null;
    bar_address: string | null;
    pour_rating: number | null;
    google_place_id?: string | null;
  }[],
): BarStat[] {
  const map = new Map<
    string,
    {
      display_name: string;
      sample_address: string | null;
      google_place_id: string | null;
      sum: number;
      rating_n: number;
      submissions: number;
    }
  >();

  for (const r of rows) {
    const raw = r.bar_name?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const prev = map.get(key);
    const pr = r.pour_rating;
    const hasRating = pr != null && Number.isFinite(Number(pr));

    const rowPid = r.google_place_id?.trim() || null;

    if (!prev) {
      map.set(key, {
        display_name: raw,
        sample_address: r.bar_address?.trim() || null,
        google_place_id: rowPid,
        sum: hasRating ? Number(pr) : 0,
        rating_n: hasRating ? 1 : 0,
        submissions: 1,
      });
      continue;
    }

    prev.submissions += 1;
    if (hasRating) {
      prev.sum += Number(pr);
      prev.rating_n += 1;
    }
    if (!prev.sample_address && r.bar_address?.trim()) {
      prev.sample_address = r.bar_address.trim();
    }
    if (!prev.google_place_id && rowPid) {
      prev.google_place_id = rowPid;
    }
  }

  return [...map.entries()]
    .map(([bar_key, v]) => ({
      bar_key,
      display_name: v.display_name,
      sample_address: v.sample_address,
      google_place_id: v.google_place_id,
      avg_pour_rating:
        v.rating_n > 0
          ? Math.round((v.sum / v.rating_n) * 100) / 100
          : null,
      rating_count: v.rating_n,
      submission_count: v.submissions,
    }))
    .sort((a, b) => b.submission_count - a.submission_count);
}

const filterFieldShell = `w-full min-h-11 rounded-lg border ${PUB_LIST_STROKE} bg-guinness-black/60 py-2 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none`;
const filterInputClass = `${filterFieldShell} px-3`;
const selectFieldClass = `${filterFieldShell} pl-3 ${NATIVE_SELECT_APPEARANCE_CLASS}`;

export async function loader(_args: LoaderFunctionArgs) {
  const { supabase } = await import("~/utils/supabase");
  const projection =
    "bar_key, display_name, sample_address, google_place_id, avg_pour_rating, rating_count, submission_count";
  const mv = await supabase
    .from("bar_pub_stats_mv")
    .select(projection)
    .order("rating_count", { ascending: false })
    .limit(120);
  if (!mv.error) {
    return { bars: (mv.data ?? []) as BarStat[], source: "view" as const };
  }

  const { data, error } = await supabase
    .from("bar_pub_stats")
    .select(
      projection,
    )
    .order("rating_count", { ascending: false })
    .limit(120);

  if (!error) {
    return { bars: (data ?? []) as BarStat[], source: "view" as const };
  }

  const { data: scores, error: scoresError } = await supabase
    .from("scores")
    .select("bar_name, bar_address, pour_rating, google_place_id")
    .not("bar_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (scoresError) throw scoresError;

  return {
    bars: aggregateFromScores(scores ?? []),
    source: "fallback" as const,
  };
}

export default function Pubs() {
  const { bars, source } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const [minPours, setMinPours] = useState("0");
  const [minRating, setMinRating] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [favIdByBarKey, setFavIdByBarKey] = useState<Record<string, string>>(
    {},
  );
  const [favBusyKey, setFavBusyKey] = useState<string | null>(null);
  const [favMessage, setFavMessage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function sync() {
      setFiltersOpen(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const loadFavorites = useCallback(async (uid: string) => {
    const supabase = await getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("user_favorite_bars")
      .select("id, bar_name")
      .eq("user_id", uid);

    if (error || !data) {
      setFavIdByBarKey({});
      return;
    }

    const next: Record<string, string> = {};
    for (const row of data) {
      const key = row.bar_name.trim().toLowerCase();
      next[key] = row.id;
    }
    setFavIdByBarKey(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function run() {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) await loadFavorites(uid);
      else setFavIdByBarKey({});
    }

    void run();
    void getSupabaseBrowserClient().then((supabase) => {
      if (cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        void run();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loadFavorites]);

  const filteredBars = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minP = Number.parseInt(minPours, 10);
    const minPoursOk = Number.isFinite(minP) ? minP : 0;
    const minR = minRating === "" ? null : Number.parseFloat(minRating);
    const minRatingOk =
      minR != null && Number.isFinite(minR) ? minR : null;

    return bars.filter((b) => {
      if (q && !b.display_name.toLowerCase().includes(q)) return false;
      if (b.submission_count < minPoursOk) return false;
      if (minRatingOk != null) {
        if (b.avg_pour_rating == null || b.rating_count === 0) return false;
        if (b.avg_pour_rating < minRatingOk) return false;
      }
      return true;
    });
  }, [bars, search, minPours, minRating]);

  async function toggleFavorite(b: BarStat) {
    setFavMessage(null);
    if (!userId) {
      setFavMessage("Sign in from Profile to save favorites.");
      return;
    }

    const supabase = await getSupabaseBrowserClient();
    const existingId = favIdByBarKey[b.bar_key];
    setFavBusyKey(b.bar_key);

    try {
      if (existingId) {
        const { error } = await supabase
          .from("user_favorite_bars")
          .delete()
          .eq("id", existingId);
        if (error) {
          setFavMessage(error.message);
          return;
        }
        setFavIdByBarKey((prev) => {
          const next = { ...prev };
          delete next[b.bar_key];
          return next;
        });
      } else {
        const { data, error } = await supabase
          .from("user_favorite_bars")
          .insert({
            user_id: userId,
            bar_name: b.display_name,
            bar_address: b.sample_address,
          })
          .select("id")
          .single();

        if (error) {
          setFavMessage(error.message);
          return;
        }
        if (data?.id) {
          setFavIdByBarKey((prev) => ({
            ...prev,
            [b.bar_key]: data.id as string,
          }));
        }
      }
    } finally {
      setFavBusyKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title="Pubs" description={pubsPageDescription}>
          <AppLink
            to="/feed"
            {...routeViewTransitionLinkProps}
            className={pageHeaderActionButtonClass}
          >
            Browse feed
          </AppLink>
        </PageHeader>
        {source === "fallback" ? (
          <p className="type-meta -mt-2 mb-6 text-guinness-tan/55">
            Using live aggregate (apply the latest migration for the optimized
            view).
          </p>
        ) : null}

        <div
          className={`mb-6 rounded-lg border ${PUB_LIST_STROKE} bg-guinness-brown/40 p-4`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="type-label text-guinness-gold">Filters</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-guinness-tan/60">
                {filteredBars.length} of {bars.length} shown
              </span>
              <button
                type="button"
                aria-expanded={filtersOpen ? "true" : "false"}
                onClick={() => setFiltersOpen((o) => !o)}
                className={`rounded-lg border ${PUB_LIST_STROKE} px-2.5 py-1 text-xs font-semibold text-guinness-gold md:hidden`}
              >
                {filtersOpen ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${filtersOpen ? "" : "hidden md:grid"}`}
          >
            <label className="flex flex-col gap-1.5">
              <span className="type-meta text-guinness-tan/80">Search name</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bar name…"
                className={filterInputClass}
                aria-label="Filter by bar name"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="type-meta text-guinness-tan/80">Min pours</span>
              <select
                className={selectFieldClass}
                value={minPours}
                onChange={(e) => setMinPours(e.target.value)}
                aria-label="Minimum pour count"
              >
                <option value="0">Any</option>
                <option value="2">2+</option>
                <option value="5">5+</option>
                <option value="10">10+</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="type-meta text-guinness-tan/80">
                Min avg rating
              </span>
              <select
                className={selectFieldClass}
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                aria-label="Minimum average pour rating"
              >
                <option value="">Any</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="4.5">4.5+</option>
              </select>
            </label>
          </div>
        </div>

        {favMessage ? (
          <p className="type-meta mb-4 text-center text-red-400/90">
            {favMessage}
          </p>
        ) : null}

        {bars.length === 0 ? (
          <p
            className={`type-meta rounded-lg border ${PUB_LIST_STROKE} bg-guinness-brown/40 p-6 text-center text-guinness-tan/75`}
          >
            No bar names saved yet. Rate a pour on a score page to add one.
          </p>
        ) : filteredBars.length === 0 ? (
          <p
            className={`type-meta rounded-lg border ${PUB_LIST_STROKE} bg-guinness-brown/40 p-6 text-center text-guinness-tan/75`}
          >
            No pubs match your filters.
          </p>
        ) : (
          <ul className="grid gap-3 sm:gap-4">
            {filteredBars.map((b) => {
              const isFav = Boolean(favIdByBarKey[b.bar_key]);
              const busy = favBusyKey === b.bar_key;
              const detailTo = pubDetailPath(b.bar_key);

              return (
                <PubVenueCard
                  key={b.bar_key}
                  title={b.display_name}
                  address={b.sample_address}
                  primaryTo={detailTo}
                  submissionCount={b.submission_count}
                  avgPourRating={b.avg_pour_rating}
                  ratingCount={b.rating_count}
                  actions={
                    <>
                      <AppLink
                        to={detailTo}
                        viewTransition
                        prefetch="intent"
                        className={pubVenueCardActionOutlineClass}
                      >
                        View
                      </AppLink>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleFavorite(b)}
                        className={
                          isFav
                            ? pubVenueCardActionSavedClass
                            : pubVenueCardActionMutedClass
                        }
                      >
                        {busy ? "…" : isFav ? "Saved" : "Favorite"}
                      </button>
                    </>
                  }
                />
              );
            })}
          </ul>
        )}

        <EndPageNewPourFooter />
      </div>
    </main>
  );
}
