import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  pubsPageDescription,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";

export type BarStat = {
  bar_key: string;
  display_name: string;
  sample_address: string | null;
  avg_pour_rating: number | null;
  rating_count: number;
  submission_count: number;
};

function aggregateFromScores(
  rows: {
    bar_name: string | null;
    bar_address: string | null;
    pour_rating: number | null;
  }[],
): BarStat[] {
  const map = new Map<
    string,
    {
      display_name: string;
      sample_address: string | null;
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

    if (!prev) {
      map.set(key, {
        display_name: raw,
        sample_address: r.bar_address?.trim() || null,
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
  }

  return [...map.entries()]
    .map(([bar_key, v]) => ({
      bar_key,
      display_name: v.display_name,
      sample_address: v.sample_address,
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

const selectFieldClass =
  "w-full min-h-11 rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none";

export async function loader(_args: LoaderFunctionArgs) {
  const { data, error } = await supabase
    .from("bar_pub_stats")
    .select("*")
    .order("rating_count", { ascending: false })
    .limit(120);

  if (!error && data && data.length > 0) {
    return { bars: data as BarStat[], source: "view" as const };
  }

  const { data: scores, error: scoresError } = await supabase
    .from("scores")
    .select("bar_name, bar_address, pour_rating")
    .not("bar_name", "is", null);

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
          <Link to="/feed" className={pageHeaderActionButtonClass}>
            Browse feed
          </Link>
        </PageHeader>
        {source === "fallback" ? (
          <p className="type-meta -mt-2 mb-6 text-guinness-tan/55">
            Using live aggregate (apply the latest migration for the optimized
            view).
          </p>
        ) : null}

        <div className="mb-6 rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="type-label text-guinness-gold">Filters</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-guinness-tan/60">
                {filteredBars.length} of {bars.length} shown
              </span>
              <button
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((o) => !o)}
                className="rounded-lg border border-guinness-gold/25 px-2.5 py-1 text-xs font-semibold text-guinness-gold md:hidden"
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
          <p className="type-meta rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-6 text-center text-guinness-tan/75">
            No bar names saved yet. Rate a pour on a score page to add one.
          </p>
        ) : filteredBars.length === 0 ? (
          <p className="type-meta rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-6 text-center text-guinness-tan/75">
            No pubs match your filters.
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredBars.map((b) => {
              const isFav = Boolean(favIdByBarKey[b.bar_key]);
              const busy = favBusyKey === b.bar_key;

              const detailTo = `/pubs/${encodeURIComponent(b.bar_key)}`;

              return (
                <li
                  key={b.bar_key}
                  className="rounded-lg border border-guinness-gold/15 bg-guinness-brown/35"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
                    <Link
                      to={detailTo}
                      viewTransition
                      className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-guinness-gold/50"
                    >
                      <p className="font-semibold text-guinness-gold hover:underline">
                        {b.display_name}
                      </p>
                      {b.sample_address ? (
                        <p className="type-meta mt-0.5 text-guinness-tan/60">
                          {b.sample_address}
                        </p>
                      ) : null}
                    </Link>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <a
                        href={mapsSearchUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="type-meta rounded-full border border-guinness-gold/25 px-2.5 py-1 text-xs font-medium text-guinness-gold hover:bg-guinness-gold/10"
                      >
                        Maps
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleFavorite(b)}
                        className={`type-meta rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          isFav
                            ? "border-guinness-gold/50 bg-guinness-gold/15 text-guinness-gold"
                            : "border-guinness-gold/25 text-guinness-tan hover:text-guinness-cream"
                        }`}
                      >
                        {busy ? "…" : isFav ? "Saved" : "Favorite"}
                      </button>
                    </div>
                  </div>
                  <Link
                    to={detailTo}
                    viewTransition
                    className="block px-4 pb-3 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-guinness-gold/40"
                  >
                    <div className="type-meta flex flex-wrap gap-x-3 gap-y-1 text-guinness-tan/70">
                      <span>{b.submission_count} pour(s)</span>
                      {b.rating_count > 0 && b.avg_pour_rating != null ? (
                        <span className="text-guinness-gold">
                          Avg rating {b.avg_pour_rating.toFixed(1)} / 5 (
                          {b.rating_count})
                        </span>
                      ) : (
                        <span>No pour ratings yet</span>
                      )}
                      <span className="text-guinness-tan/50">
                        View details →
                      </span>
                    </div>
                  </Link>
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
