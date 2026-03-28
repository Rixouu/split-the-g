import { SegmentedTabs } from "~/components/ui/segmented-tabs";
import { useProfileOutlet } from "./profile-context";
import { progressRangeOptions, type ProgressRange } from "./profile-shared";

export default function ProfileProgressPage() {
  const {
    scores,
    progressStats,
    progressRange,
    setProgressRange,
    friendProgressLeaderboard,
  } = useProfileOutlet();

  return (
    <div className="space-y-8">
      {scores.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Pours", value: String(progressStats.count) },
              { label: "Best", value: progressStats.best.toFixed(2) },
              { label: "Avg / 5", value: progressStats.avg.toFixed(2) },
              { label: "Last 7d", value: String(progressStats.last7) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#322914] bg-guinness-brown/35 p-4 text-center"
              >
                <p className="type-meta text-guinness-tan/70">{item.label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-guinness-gold">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[#322914] bg-guinness-brown/30 p-4 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-center">
              <div className="mx-auto flex w-full max-w-[16rem] flex-col items-center gap-3">
                <div className="profile-progress-shell">
                  <div className="profile-progress-glow" />
                  <div className="profile-progress-orbit" />
                  <div
                    className="relative flex h-44 w-44 items-center justify-center rounded-full border border-[#322914] shadow-[inset_0_0_0_10px_rgba(9,9,7,0.7)]"
                    style={{
                      background: `conic-gradient(rgba(213,178,99,0.98) 0 ${progressStats.dialPct}%, rgba(55,44,22,0.45) ${progressStats.dialPct}% 100%)`,
                    }}
                    aria-hidden
                  >
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-[#322914] bg-guinness-black/95 shadow-[0_0_22px_rgba(0,0,0,0.45)]">
                      <span className="type-meta text-guinness-tan/70">Average</span>
                      <span className="text-3xl font-bold tabular-nums text-guinness-gold">
                        {progressStats.avg.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="type-meta text-center text-guinness-tan/75">
                  Last 7 days:{" "}
                  <span className="font-semibold text-guinness-cream">
                    {progressStats.last7}
                  </span>{" "}
                  pour(s)
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: "Average",
                    value: progressStats.avg,
                    accent: "bg-guinness-gold",
                  },
                  {
                    label: "Best",
                    value: progressStats.best,
                    accent: "bg-[#322914] ring-1 ring-guinness-gold/25",
                  },
                  {
                    label: "Recent volume",
                    value: Math.min(progressStats.last7, 5),
                    accent: "bg-guinness-tan",
                    suffix: ` (${progressStats.last7} in 7d)`,
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-guinness-cream">
                        {item.label}
                      </span>
                      <span className="type-meta text-guinness-tan/70">
                        {item.value.toFixed(2)}
                        {item.suffix ?? " / 5.00"}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border border-[#322914]/80 bg-guinness-black/60">
                      <div
                        className={`h-full rounded-full ${item.accent}`}
                        style={{
                          width: `${Math.max(8, Math.min(100, (item.value / 5) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-[#322914] bg-guinness-brown/30 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="type-card-title">Friends leaderboard</h2>
                <p className="type-meta mt-1 text-guinness-tan/70">
                  Compare your average, best score, and volume against accepted friends.
                </p>
              </div>
              <SegmentedTabs
                value={progressRange}
                onValueChange={(v) => setProgressRange(v as ProgressRange)}
                items={progressRangeOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                layoutClassName="flex w-full min-w-0 sm:flex-1"
                aria-label="Time range"
              />
            </div>

            {friendProgressLeaderboard.length > 0 ? (
              <ol className="mt-5 space-y-2">
                {friendProgressLeaderboard.slice(0, 8).map((entry, index) => (
                  <li
                    key={entry.email}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[auto_minmax(0,1.3fr)_repeat(3,auto)] sm:gap-4 ${
                      entry.isCurrentUser
                        ? "border-guinness-gold/35 bg-guinness-gold/10"
                        : "border-[#322914] bg-guinness-black/30"
                    }`}
                  >
                    <span className="text-sm font-semibold tabular-nums text-guinness-gold">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-guinness-cream">
                        {entry.label}
                        {entry.isCurrentUser ? " · You" : ""}
                      </p>
                      <p className="type-meta truncate text-guinness-tan/60">{entry.email}</p>
                    </div>
                    <span className="text-sm tabular-nums text-guinness-tan/80 sm:text-right">
                      {entry.pours} pours
                    </span>
                    <span className="hidden text-sm tabular-nums text-guinness-tan/80 sm:block">
                      Avg {entry.avg.toFixed(2)}
                    </span>
                    <span className="hidden text-sm tabular-nums text-guinness-tan/80 sm:block">
                      Best {entry.best.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="type-meta mt-5 text-guinness-tan/70">
                Accept a few friends to unlock side-by-side progress comparisons.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="type-meta text-guinness-tan/70">
          No scores linked to this email yet. Open a result you own and tap &quot;Claim with
          Google&quot;.
        </p>
      )}
    </div>
  );
}
