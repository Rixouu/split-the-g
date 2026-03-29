import { Link } from "react-router";
import { useMemo } from "react";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { seoMeta } from "~/utils/seo";
import { useProfileOutlet } from "./profile-context";

export function meta() {
  return seoMeta({
    title: "Profile Expenses",
    description: "See pint spend totals and price trends from your linked Split the G pours.",
    path: "/profile/expenses",
    keywords: ["pint spend", "beer expenses", "split the g prices"],
  });
}

export default function ProfileExpensesPage() {
  const { scores, progressStats } = useProfileOutlet();

  const pricedPours = useMemo(
    () =>
      scores.filter(
        (s) =>
          s.pint_price != null && Number.isFinite(Number(s.pint_price)),
      ),
    [scores],
  );

  const avgPrice =
    pricedPours.length > 0
      ? progressStats.totalSpend / pricedPours.length
      : 0;

  const maxPour = useMemo(() => {
    if (pricedPours.length === 0) return null;
    let best = pricedPours[0]!;
    let bestN = Number(best.pint_price);
    for (const s of pricedPours) {
      const n = Number(s.pint_price);
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    return best;
  }, [pricedPours]);

  if (scores.length === 0) {
    return (
      <p className="type-meta text-guinness-tan/70">
        No scores linked to this email yet. Claim a pour and add a pint price to
        track spend here.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="type-meta text-guinness-tan/75">
        Spend totals use pint prices you enter on pours (optional field). Figures
        below are from your recent linked scores loaded in this session.
      </p>

      <div className="rounded-2xl border border-[#322914] bg-guinness-brown/35 p-6 text-center sm:p-8">
        <p className="type-meta text-guinness-tan/70">Spend tracked</p>
        <p className="mt-2 text-4xl font-bold tabular-nums text-guinness-gold sm:text-5xl">
          {progressStats.totalSpend > 0
            ? progressStats.totalSpend.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "—"}
        </p>
        <p className="type-meta mx-auto mt-3 max-w-md text-guinness-tan/50">
          Sum of pint prices you entered on pours (only pours with a price count
          toward this total).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#322914] bg-guinness-brown/30 p-4 text-center">
          <p className="type-meta text-guinness-tan/70">Pours with a price</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">
            {pricedPours.length}
          </p>
          <p className="type-meta mt-2 text-guinness-tan/50">
            Of {scores.length} recent score{scores.length === 1 ? "" : "s"} shown
          </p>
        </div>
        <div className="rounded-xl border border-[#322914] bg-guinness-brown/30 p-4 text-center">
          <p className="type-meta text-guinness-tan/70">Avg pint price</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">
            {pricedPours.length > 0
              ? avgPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </p>
          <p className="type-meta mt-2 text-guinness-tan/50">
            Across priced pours only
          </p>
        </div>
        <div className="rounded-xl border border-[#322914] bg-guinness-brown/30 p-4 text-center">
          <p className="type-meta text-guinness-tan/70">Highest single pour</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">
            {maxPour
              ? Number(maxPour.pint_price).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </p>
          {maxPour?.bar_name ? (
            <p className="type-meta mt-2 line-clamp-2 text-guinness-tan/50">
              {maxPour.bar_name}
            </p>
          ) : (
            <p className="type-meta mt-2 text-guinness-tan/50">
              From your priced pours
            </p>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-[#322914] bg-guinness-brown/25 p-5 sm:p-6">
        <h2 className="type-card-title">Recent pours with a price</h2>
        <p className="type-meta mt-1 text-guinness-tan/65">
          Tap through to the full score. Add or edit price from the pour flow if
          you skipped it.
        </p>
        {pricedPours.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {pricedPours.map((s) => (
              <li key={s.id}>
                <Link
                  to={scorePourPathFromFields(s)}
                  prefetch="intent"
                  viewTransition
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[#322914] bg-guinness-black/30 px-4 py-3 transition-colors hover:border-guinness-gold/30"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-guinness-cream">
                      {Number(s.pint_price).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {s.bar_name ? (
                      <p className="type-meta truncate text-guinness-tan/55">
                        {s.bar_name}
                      </p>
                    ) : null}
                  </div>
                  <span className="type-meta shrink-0 text-guinness-tan/60">
                    {new Date(s.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-meta mt-4 text-guinness-tan/70">
            No prices on your recent pours yet. Next time you split, add the pint
            price to build a spend history.
          </p>
        )}
      </section>
    </div>
  );
}
