import { Link } from "react-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { WallDateRangeField } from "~/components/wall/WallDateRangeField";
import { flagEmojiFromIso2, getCountryOptions } from "~/utils/countryDisplay";
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

const selectFieldClass =
  "w-full min-h-11 rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2.5 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none";

interface PubWallTabProps {
  items: PubWallRow[];
  pubStroke: string;
}

export function PubWallTab({ items, pubStroke }: PubWallTabProps) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [minScore, setMinScore] = useState<string>("0");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [countryFilter, setCountryFilter] = useState<string>("");
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

  const wallCountrySelectOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const s of items) {
      const c = s.country_code?.trim().toUpperCase();
      if (c && /^[A-Z]{2}$/.test(c)) codes.add(c);
    }
    const nameByCode = new Map(
      getCountryOptions().map((o) => [o.code.toUpperCase(), o.name] as const),
    );
    return [...codes].sort().map((code) => ({
      code,
      name: nameByCode.get(code) ?? code,
    }));
  }, [items]);

  const filtered = useMemo(() => {
    const min = Number.parseFloat(minScore);
    const minOk = Number.isFinite(min) ? min : 0;
    const fromTs = dateFrom ? startOfLocalDay(dateFrom) : null;
    const toTs = dateTo ? endOfLocalDay(dateTo) : null;
    const countryWant = countryFilter.trim().toUpperCase();

    const list = items.filter((s) => {
      if (s.split_score < minOk) return false;
      const t = new Date(s.created_at).getTime();
      if (fromTs != null && Number.isFinite(fromTs) && t < fromTs) return false;
      if (toTs != null && Number.isFinite(toTs) && t > toTs) return false;
      if (countryWant) {
        const got = s.country_code?.trim().toUpperCase() ?? "";
        if (got !== countryWant) return false;
      }
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
  }, [items, sort, minScore, dateFrom, dateTo, countryFilter]);

  useEffect(() => {
    setPage(1);
  }, [filtered.length, sort, minScore, dateFrom, dateTo, countryFilter]);

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
        className={`w-full min-w-0 rounded-xl border ${pubStroke} bg-guinness-brown/30 p-5 sm:p-6`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="type-label text-guinness-gold">Filters</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-guinness-tan/60 sm:text-sm">
              {filtered.length} pour{filtered.length === 1 ? "" : "s"} · Page{" "}
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              aria-expanded={filtersOpen ? "true" : "false"}
              onClick={() => setFiltersOpen((o) => !o)}
              className={`rounded-lg border ${pubStroke} px-2.5 py-1 text-xs font-semibold text-guinness-gold md:hidden`}
            >
              {filtersOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div
          className={`grid w-full min-w-0 grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-6 xl:grid-cols-4 ${filtersOpen ? "" : "hidden md:grid"}`}
        >
          <label className="flex min-w-0 flex-col gap-2">
            <span className="type-meta text-guinness-tan/80">Sort by</span>
            <select
              className={selectFieldClass}
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
          <label className="flex min-w-0 flex-col gap-2">
            <span className="type-meta text-guinness-tan/80">Minimum score</span>
            <select
              className={selectFieldClass}
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
          <div className="min-w-0 sm:min-w-[12rem]">
            <WallDateRangeField
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
              }}
            />
          </div>
          <label className="flex min-w-0 flex-col gap-2">
            <span className="type-meta text-guinness-tan/80">Country</span>
            <select
              className={selectFieldClass}
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="Filter by country"
            >
              <option value="">Any country</option>
              {wallCountrySelectOptions.map(({ code, name }) => (
                <option key={code} value={code}>
                  {flagEmojiFromIso2(code)} {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {pageSlice.length === 0 ? (
        <div className="rounded-lg border border-guinness-gold/15 bg-guinness-brown/25 py-10 text-center">
          <p className="type-meta text-guinness-tan/80">
            No pours match these filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setMinScore("0");
              setDateFrom("");
              setDateTo("");
              setCountryFilter("");
              setSort("newest");
            }}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-guinness-gold px-5 py-2 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="grid w-full min-w-0 grid-cols-2 gap-2.5 sm:gap-4">
          {pageSlice.map((row) => (
            <li key={row.id} className="min-w-0">
              <Link
                to={scorePourPathFromFields(row)}
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
                      {flagEmojiFromIso2(row.country_code) ? (
                        <span
                          className="mr-1.5 inline-block shrink-0 text-[1.2em] leading-none align-middle"
                          title={
                            row.country_code?.trim().toUpperCase() ?? undefined
                          }
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
