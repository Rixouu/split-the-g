import { type LoaderFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { supabase } from "~/utils/supabase";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  standardPageDescription,
} from "~/components/PageHeader";
import { LeaderboardButton } from "~/components/leaderboard/LeaderboardButton";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_COLLAGE_COLUMNS } from "~/utils/scoresListColumns";

type Submission = {
  id: string;
  slug?: string | null;
  username: string;
  split_image_url: string;
  pint_image_url: string;
  created_at: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  split_score: number;
  bar_name?: string;
  bar_address?: string;
};

type SortOption = "newest" | "oldest" | "score_high" | "score_low";

export const loader: LoaderFunction = async () => {
  const { data, error } = await supabase
    .from("scores")
    .select(SCORES_COLLAGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) throw error;

  return { submissions: data ?? [] };
};

function formatLocation(submission: Submission) {
  const parts: string[] = [];
  if (submission.city) parts.push(submission.city);
  if (submission.region) parts.push(submission.region);
  if (submission.country_code) parts.push(submission.country_code);
  return parts.length > 0 ? parts.join(", ") : "";
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const selectFieldClass =
  "w-full min-h-11 rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none sm:min-w-[10.5rem]";

/** Local calendar day bounds for date range filter (matches how users pick dates in the UI). */
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

export default function Collage() {
  const { submissions } = useLoaderData<{ submissions: Submission[] }>();
  const [sort, setSort] = useState<SortOption>("newest");
  const [minScore, setMinScore] = useState<string>("0");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
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

  const filtered = useMemo(() => {
    const min = parseFloat(minScore);
    const minOk = Number.isFinite(min) ? min : 0;
    const fromTs = dateFrom ? startOfLocalDay(dateFrom) : null;
    const toTs = dateTo ? endOfLocalDay(dateTo) : null;

    let list = submissions.filter((s) => {
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
  }, [submissions, sort, minScore, dateFrom, dateTo]);

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <div className="mb-8 space-y-6">
          <PageHeader
            title="Split the G Collection"
            description={standardPageDescription}
          >
            <LeaderboardButton />
            <Link to="/" className={pageHeaderActionButtonClass}>
              Back to Split
            </Link>
          </PageHeader>

          <div className="rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="type-label text-guinness-gold">Filters</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-guinness-tan/60 sm:text-sm">
                  {filtered.length} of {submissions.length} shown
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
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${filtersOpen ? "" : "hidden md:grid"}`}
            >
              <label className="flex flex-col gap-1.5">
                <span className="type-meta text-guinness-tan/80">Sort by</span>
                <select
                  className={selectFieldClass}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  aria-label="Sort submissions"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="score_high">Highest score</option>
                  <option value="score_low">Lowest score</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="type-meta text-guinness-tan/80">
                  Minimum score
                </span>
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
              <label className="flex flex-col gap-1.5">
                <span className="type-meta text-guinness-tan/80">From date</span>
                <input
                  type="date"
                  className={selectFieldClass}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Filter pours from this date"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="type-meta text-guinness-tan/80">To date</span>
                <input
                  type="date"
                  className={selectFieldClass}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Filter pours until this date"
                />
              </label>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-guinness-gold/20 bg-guinness-brown/30 py-16 text-center">
            <p className="type-section text-xl">No pours match your filters</p>
            <p className="type-meta mx-auto mt-2 max-w-sm">
              Try lowering the minimum score or widening the date range.
            </p>
            <button
              type="button"
              onClick={() => {
                setMinScore("0");
                setDateFrom("");
                setDateTo("");
                setSort("newest");
              }}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-guinness-gold px-6 py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((submission) => {
              const loc = formatLocation(submission);
              return (
                <li key={submission.id} className="min-w-0">
                  <Link
                    to={scorePourPathFromFields(submission)}
                    className="group block h-full rounded-lg border border-guinness-gold/15 bg-guinness-gold/5 p-3 transition-colors hover:border-guinness-gold/35 hover:bg-guinness-gold/10"
                  >
                    <div className="overflow-hidden rounded-lg bg-guinness-black/50 aspect-[3/4]">
                      <img
                        src={submission.pint_image_url}
                        alt={`Pour by ${submission.username}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-3 space-y-1.5 rounded-lg bg-guinness-black/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-base font-semibold text-guinness-cream">
                          {submission.username}
                        </span>
                        <span className="shrink-0 tabular-nums text-guinness-gold font-semibold">
                          {submission.split_score.toFixed(2)}
                          <span className="text-guinness-tan/70 font-normal text-sm">
                            /5
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-guinness-tan/65">
                        {formatDateTime(submission.created_at)}
                      </p>
                      {loc ? (
                        <p className="text-xs text-guinness-tan/50">{loc}</p>
                      ) : null}
                      {submission.bar_name ? (
                        <p className="line-clamp-2 text-xs text-guinness-tan/45">
                          {submission.bar_name}
                          {submission.bar_address
                            ? ` · ${submission.bar_address}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-10 flex justify-center pb-6">
          <Link
            to="/"
            className="inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-lg border border-guinness-gold/25 bg-guinness-brown/50 px-6 py-3 text-sm font-medium text-guinness-gold transition-colors hover:border-guinness-gold/40 hover:bg-guinness-brown/70 sm:w-auto"
          >
            Back to Split
          </Link>
        </div>
      </div>
    </main>
  );
}
