import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  pubsPageDescription,
} from "~/components/PageHeader";
import { routeViewTransitionLinkProps } from "~/utils/routeViewTransition";
import { supabase } from "~/utils/supabase";
import { pubDetailPath } from "~/utils/pubPath";

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

function mapsSearchUrl(b: BarStat): string {
  const q = [b.display_name, b.sample_address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function IconPubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" />
      <path d="M12 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  );
}

function IconPour({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2h8l-1 14a4 4 0 0 1-6 0L8 2Z" />
      <path d="M10 22h4" />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Dark brown stroke — no light/white borders on pub list UI. */
const PUB_LIST_STROKE = "border-[#322914]";

function StatPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border ${PUB_LIST_STROKE} bg-guinness-black/45 px-2.5 py-1 text-xs font-medium text-guinness-tan/90 tabular-nums`}
    >
      <span className="text-guinness-gold/80 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      {children}
    </span>
  );
}

const selectFieldClass = `w-full min-h-11 rounded-lg border ${PUB_LIST_STROKE} bg-guinness-black/60 px-3 py-2 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none`;

export async function loader(_args: LoaderFunctionArgs) {
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

    async function run() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) await loadFavorites(uid);
      else setFavIdByBarKey({});
    }

    void run();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void run();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
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
          <Link
            to="/feed"
            {...routeViewTransitionLinkProps}
            className={pageHeaderActionButtonClass}
          >
            Browse feed
          </Link>
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
                className={selectFieldClass}
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
              const pourLabel =
                b.submission_count === 1 ? "1 pour" : `${b.submission_count} pours`;

              return (
                <li
                  key={b.bar_key}
                  className={`group relative overflow-hidden rounded-2xl border ${PUB_LIST_STROKE} bg-gradient-to-br from-guinness-brown/50 via-guinness-brown/35 to-guinness-black/40 shadow-[inset_0_1px_0_rgba(212,175,55,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-guinness-gold/25 hover:shadow-[inset_0_1px_0_rgba(212,175,55,0.07)]`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-guinness-gold/[0.06] blur-2xl" />
                  <div className="relative flex flex-col sm:flex-row sm:items-stretch">
                    <Link
                      to={detailTo}
                      viewTransition
                      className="flex min-w-0 flex-1 gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-guinness-gold/45 sm:gap-4 sm:p-5"
                    >
                      <div className="relative flex shrink-0 flex-col items-center">
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${PUB_LIST_STROKE} bg-guinness-gold/[0.08] text-guinness-gold sm:h-16 sm:w-16`}
                        >
                          <IconPubMark className="h-7 w-7 sm:h-8 sm:w-8" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-lg font-semibold leading-snug text-guinness-gold transition-colors group-hover:text-guinness-tan sm:text-xl">
                            {b.display_name}
                          </h2>
                          <IconChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-guinness-gold/45 transition-transform group-hover:translate-x-0.5 group-hover:text-guinness-gold/70 sm:hidden" />
                        </div>
                        {b.sample_address ? (
                          <p className="type-meta mt-1 line-clamp-2 text-guinness-tan/65">
                            {b.sample_address}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatPill icon={<IconPour />}>{pourLabel}</StatPill>
                          {b.rating_count > 0 && b.avg_pour_rating != null ? (
                            <StatPill icon={<IconStar />}>
                              <span className="text-guinness-gold">
                                {b.avg_pour_rating.toFixed(1)}
                              </span>
                              <span className="text-guinness-tan/55">/ 5</span>
                              <span className="text-guinness-tan/45">
                                · {b.rating_count}{" "}
                                {b.rating_count === 1 ? "rating" : "ratings"}
                              </span>
                            </StatPill>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded-lg border border-dashed ${PUB_LIST_STROKE} bg-guinness-black/25 px-2.5 py-1 text-xs text-guinness-tan/50`}
                            >
                              No ratings yet
                            </span>
                          )}
                        </div>
                        <p className="type-meta mt-3 hidden items-center gap-1 text-guinness-gold/70 sm:flex">
                          Pub page
                          <IconChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </p>
                      </div>
                    </Link>

                    <div
                      className={`flex shrink-0 flex-row gap-2 border-t ${PUB_LIST_STROKE} p-4 pt-3 sm:w-auto sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:py-5 sm:pl-4 sm:pr-5`}
                    >
                      <a
                        href={mapsSearchUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border ${PUB_LIST_STROKE} bg-guinness-black/50 px-3 text-xs font-semibold text-guinness-gold transition-colors hover:border-guinness-gold/35 hover:bg-guinness-gold/10 sm:flex-none sm:min-w-[5.75rem]`}
                      >
                        Maps
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleFavorite(b)}
                        className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors disabled:opacity-50 sm:flex-none sm:min-w-[5.75rem] ${
                          isFav
                            ? "border-guinness-gold/40 bg-guinness-gold/12 text-guinness-gold"
                            : `${PUB_LIST_STROKE} bg-guinness-black/35 text-guinness-tan hover:border-guinness-gold/30 hover:text-guinness-cream`
                        }`}
                      >
                        {busy ? "…" : isFav ? "Saved" : "Favorite"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-10 flex justify-center pb-6">
          <Link
            to="/feed"
            className={`${pageHeaderActionButtonClass} w-full max-w-xs sm:w-auto`}
          >
            Browse feed
          </Link>
        </div>
      </div>
    </main>
  );
}
