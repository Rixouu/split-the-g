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
    <div className="space-y-6 sm:space-y-8">
      <p className="type-meta text-guinness-tan/75">
        Spend totals use pint prices you enter on pours (optional field). Figures
        below are from your recent linked scores loaded in this session.
      </p>

      <div className="rounded-2xl border border-[#322914] bg-guinness-brown/35 p-5 text-center sm:p-8">
        <p className="type-meta text-guinness-tan/70">Spend tracked</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-guinness-gold sm:text-5xl">
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

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-col rounded-xl border border-[#322914] bg-guinness-brown/30 p-2.5 text-center sm:p-4">
          <p className="text-[10px] font-medium leading-tight text-guinness-tan/70 sm:type-meta sm:font-normal">
            Priced pours
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-guinness-gold sm:mt-1 sm:text-2xl">
            {pricedPours.length}
          </p>
          <p className="mt-1 hidden text-guinness-tan/50 sm:type-meta sm:block">
            Of {scores.length} recent score{scores.length === 1 ? "" : "s"} shown
          </p>
        </div>
        <div className="flex min-w-0 flex-col rounded-xl border border-[#322914] bg-guinness-brown/30 p-2.5 text-center sm:p-4">
          <p className="text-[10px] font-medium leading-tight text-guinness-tan/70 sm:type-meta sm:font-normal">
            Avg price
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-guinness-gold sm:text-2xl">
            {pricedPours.length > 0
              ? avgPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </p>
          <p className="mt-1 hidden text-guinness-tan/50 sm:type-meta sm:block">
            Across priced pours only
          </p>
        </div>
        <div className="flex min-w-0 flex-col rounded-xl border border-[#322914] bg-guinness-brown/30 p-2.5 text-center sm:p-4">
          <p className="text-[10px] font-medium leading-tight text-guinness-tan/70 sm:type-meta sm:font-normal">
            Highest pour
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-guinness-gold sm:text-2xl">
            {maxPour
              ? Number(maxPour.pint_price).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </p>
          {maxPour?.bar_name ? (
            <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-guinness-tan/55 sm:type-meta sm:mt-2">
              {maxPour.bar_name}
            </p>
          ) : (
            <p className="mt-1 hidden text-guinness-tan/50 sm:type-meta sm:block">
              From your priced pours
            </p>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-[#322914] bg-guinness-brown/25 p-4 sm:p-6">
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
                  className="flex flex-col gap-1.5 rounded-xl border border-[#322914] bg-guinness-black/30 px-3 py-3 transition-colors hover:border-guinness-gold/30 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-lg font-semibold tabular-nums text-guinness-cream sm:text-base sm:font-medium">
                        {Number(s.pint_price).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <span className="type-meta shrink-0 text-guinness-tan/60 sm:hidden">
                        {new Date(s.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {s.bar_name ? (
                      <p className="type-meta truncate text-guinness-tan/55">
                        {s.bar_name}
                      </p>
                    ) : null}
                  </div>
                  <span className="type-meta hidden shrink-0 text-guinness-tan/60 sm:block">
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
