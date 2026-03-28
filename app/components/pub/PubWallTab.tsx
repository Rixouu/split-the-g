import { Link } from "react-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { scorePourPathFromFields } from "~/utils/scorePath";

export type PubWallRow = {
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

type SortOption = "newest" | "oldest" | "score_high" | "score_low";

const PAGE_SIZE = 12;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startOfLocalDay(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function endOfLocalDay(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

/** No fixed min-width — avoids grid overflow and date picker clipping in narrow columns. */
const filterSelectClass =
  "box-border w-full min-w-0 max-w-full min-h-11 rounded-lg border border-[#322914] bg-guinness-black/60 px-3 py-2 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none";

const filterDateClass = `${filterSelectClass} pr-2 [color-scheme:dark]`;

interface PubWallTabProps {
  items: PubWallRow[];
  pubStroke: string;
}

export function PubWallTab({ items, pubStroke }: PubWallTabProps) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [minScore, setMinScore] = useState<string>("0");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function sync() {
      setFiltersOpen(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const filtered = useMemo(() => {
    const min = Number.parseFloat(minScore);
    const minOk = Number.isFinite(min) ? min : 0;
    const fromTs = dateFrom ? startOfLocalDay(dateFrom) : null;
    const toTs = dateTo ? endOfLocalDay(dateTo) : null;

    let list = items.filter((s) => {
      if (s.split_score < minOk) return false;
      const t = new Date(s.created_at).getTime();
      if (fromTs != null && Number.isFinite(fromTs) && t < fromTs) return false;
      if (toTs != null && Number.isFinite(toTs) && t > toTs) return false;
      return true;
    });

    const sorted = [...list];
    switch (sort) {
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        break;
      case "score_high":
        sorted.sort((a, b) => b.split_score - a.split_score);
        break;
      case "score_low":
        sorted.sort((a, b) => a.split_score - b.split_score);
        break;
      case "newest":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
    return sorted;
  }, [items, sort, minScore, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [filtered.length, sort, minScore, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  if (items.length === 0) {
    return (
      <p className="type-meta text-guinness-tan/70">
        No pours recorded for this pub name yet. Be the first from the home
        screen.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div
        className={`w-full min-w-0 rounded-xl border ${pubStroke} bg-guinness-brown/30 p-4 sm:p-5`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="type-label text-guinness-gold">Filters</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-guinness-tan/60 sm:text-sm">
              {filtered.length} pour{filtered.length === 1 ? "" : "s"} · Page{" "}
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((o) => !o)}
              className={`rounded-lg border ${pubStroke} px-2.5 py-1 text-xs font-semibold text-guinness-gold md:hidden`}
            >
              {filtersOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div
          className={`grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${filtersOpen ? "" : "hidden md:grid"}`}
        >
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="type-meta text-guinness-tan/80">Sort by</span>
            <select
              className={filterSelectClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              aria-label="Sort pours"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="score_high">Highest score</option>
              <option value="score_low">Lowest score</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="type-meta text-guinness-tan/80">Minimum score</span>
            <select
              className={filterSelectClass}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              aria-label="Minimum split score"
            >
              <option value="0">Any score</option>
              <option value="2">2.0+</option>
              <option value="3">3.0+</option>
              <option value="3.5">3.5+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="type-meta text-guinness-tan/80">From date</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={filterDateClass}
              aria-label="Filter from date"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="type-meta text-guinness-tan/80">To date</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={filterDateClass}
              aria-label="Filter to date"
            />
          </label>
        </div>
      </div>

      {pageSlice.length === 0 ? (
        <p className="type-meta text-guinness-tan/70">
          No pours match these filters.
        </p>
      ) : (
        <ul className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11.5rem,1fr))] sm:gap-4">
          {pageSlice.map((row) => (
            <li key={row.id} className="min-w-0">
              <Link
                to={scorePourPathFromFields(row)}
                prefetch="intent"
                viewTransition
                className={`group block overflow-hidden rounded-lg border ${pubStroke} bg-guinness-brown/30 transition-colors hover:border-guinness-gold/35`}
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
                      No image
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2.5 sm:p-3">
                  <div className="flex items-start justify-between gap-1">
                    <span className="line-clamp-2 text-xs font-semibold text-guinness-cream sm:text-sm">
                      {row.username}
                    </span>
                    <span className="shrink-0 tabular-nums text-sm font-semibold text-guinness-gold">
                      {Number(row.split_score).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-guinness-tan/55 sm:text-xs">
                    {formatWhen(row.created_at)}
                  </p>
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
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`rounded-lg border ${pubStroke} px-4 py-2 text-sm font-semibold text-guinness-gold disabled:opacity-40`}
          >
            Previous
          </button>
          <span className="type-meta text-guinness-tan/70">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`rounded-lg border ${pubStroke} px-4 py-2 text-sm font-semibold text-guinness-gold disabled:opacity-40`}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
