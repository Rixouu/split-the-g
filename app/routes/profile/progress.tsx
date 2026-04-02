import { SegmentedTabs } from "~/components/ui/segmented-tabs";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { useProfileOutlet } from "./profile-context";
import {
  pourStreakCalendarDays,
  progressRangeOptions,
  type ProgressRange,
} from "./profile-shared";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/progress", "progress");
}

export default function ProfileProgressPage() {
  const { t } = useI18n();
  const {
    scores,
    progressStats,
    progressRange,
    setProgressRange,
    friendProgressLeaderboard,
    persistedAchievementCodes,
    streakSnapshot,
  } = useProfileOutlet();

  const progressTabLabel: Record<ProgressRange, string> = {
    "7d": t("pages.profile.progressTab7d"),
    "30d": t("pages.profile.progressTab30d"),
    "90d": t("pages.profile.progressTab90d"),
    all: t("pages.profile.progressTabAll"),
  };

  const scoreTrend = scores.slice(0, 24).reverse();
  const totalPints = scores.length;
  const averageScore = progressStats.avg;
  const mostVisitedPubEntry = (() => {
    const counter = new Map<string, number>();
    for (const s of scores) {
      const key = s.bar_name?.trim();
      if (!key) continue;
      counter.set(key, (counter.get(key) ?? 0) + 1);
    }
    let bestName = "";
    let bestCount = 0;
    for (const [name, count] of counter.entries()) {
      if (count > bestCount) {
        bestName = name;
        bestCount = count;
      }
    }
    return bestName ? { name: bestName, count: bestCount } : null;
  })();

  const weeklyStreak = (() => {
    if (scores.length === 0) return 0;
    const weekKeys = new Set(
      scores.map((s) => {
        const d = new Date(s.created_at);
        const day = d.getDay();
        const mondayShift = (day + 6) % 7;
        const monday = new Date(d);
        monday.setHours(12, 0, 0, 0);
        monday.setDate(monday.getDate() - mondayShift);
        return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      }),
    );
    const probe = new Date();
    const day = probe.getDay();
    const mondayShift = (day + 6) % 7;
    probe.setHours(12, 0, 0, 0);
    probe.setDate(probe.getDate() - mondayShift);
    let streak = 0;
    for (let i = 0; i < 104; i++) {
      const key = `${probe.getFullYear()}-${probe.getMonth()}-${probe.getDate()}`;
      if (weekKeys.has(key)) {
        streak++;
        probe.setDate(probe.getDate() - 7);
      } else {
        break;
      }
    }
    return streak;
  })();

  const weekendStreak = (() => {
    if (scores.length === 0) return 0;
    const weekendKeys = new Set(
      scores
        .filter((s) => {
          const d = new Date(s.created_at).getDay();
          return d === 0 || d === 6;
        })
        .map((s) => {
          const d = new Date(s.created_at);
          const day = d.getDay();
          const saturdayShift = day === 0 ? 1 : day - 6;
          const saturday = new Date(d);
          saturday.setHours(12, 0, 0, 0);
          saturday.setDate(saturday.getDate() - saturdayShift);
          return `${saturday.getFullYear()}-${saturday.getMonth()}-${saturday.getDate()}`;
        }),
    );
    const probe = new Date();
    const pDay = probe.getDay();
    const saturdayShift = pDay === 0 ? 1 : pDay - 6;
    probe.setHours(12, 0, 0, 0);
    probe.setDate(probe.getDate() - saturdayShift);
    let streak = 0;
    for (let i = 0; i < 104; i++) {
      const key = `${probe.getFullYear()}-${probe.getMonth()}-${probe.getDate()}`;
      if (weekendKeys.has(key)) {
        streak++;
        probe.setDate(probe.getDate() - 7);
      } else {
        break;
      }
    }
    return streak;
  })();

  const achievements = [
    {
      key: "perfect",
      label: t("pages.profile.badgePerfect"),
      unlocked:
        persistedAchievementCodes.includes("perfect-score") ||
        scores.some((s) => s.split_score >= 4.95),
    },
    {
      key: "pints10",
      label: t("pages.profile.badgePints10"),
      unlocked:
        persistedAchievementCodes.includes("pints-10") || totalPints >= 10,
    },
    {
      key: "pints25",
      label: t("pages.profile.badgePints25"),
      unlocked:
        persistedAchievementCodes.includes("pints-25") || totalPints >= 25,
    },
    {
      key: "crawler",
      label: t("pages.profile.badgePubCrawler"),
      unlocked: persistedAchievementCodes.includes("pub-crawler-5")
        || new Set(scores.map((s) => s.bar_name?.trim()).filter(Boolean)).size >= 5,
    },
    {
      key: "early",
      label: t("pages.profile.badgeEarlyBird"),
      unlocked:
        persistedAchievementCodes.includes("early-bird")
        || scores.some((s) => new Date(s.created_at).getHours() < 17),
    },
    {
      key: "weekend",
      label: t("pages.profile.badgeWeekendStreak"),
      unlocked:
        persistedAchievementCodes.includes("weekend-warrior-3") ||
        weekendStreak >= 3,
    },
    {
      key: "streak7",
      label: t("pages.profile.badgeDailyStreak7"),
      unlocked:
        persistedAchievementCodes.includes("daily-streak-7")
        || pourStreakCalendarDays(scores) >= 7,
    },
    {
      key: "elite",
      label: t("pages.profile.badgeEliteAverage"),
      unlocked:
        persistedAchievementCodes.includes("elite-average")
        || (scores.length >= 10 && averageScore >= 4.3),
    },
  ];

  const streakDaily = streakSnapshot?.daily ?? pourStreakCalendarDays(scores);
  const streakWeekly = streakSnapshot?.weekly ?? weeklyStreak;
  const streakWeekend = streakSnapshot?.weekend ?? weekendStreak;

  const trendPoints =
    scoreTrend.length <= 1
      ? ""
      : scoreTrend
          .map((s, i) => {
            const x = (i / (scoreTrend.length - 1)) * 100;
            const y = 100 - (Math.max(0, Math.min(5, s.split_score)) / 5) * 100;
            return `${x},${y}`;
          })
          .join(" ");

  const scoreBuckets = [
    { key: "0-2", min: 0, max: 2 },
    { key: "2-3", min: 2, max: 3 },
    { key: "3-4", min: 3, max: 4 },
    { key: "4-5", min: 4, max: 5.01 },
  ].map((bucket) => {
    const count = scores.filter(
      (s) => s.split_score >= bucket.min && s.split_score < bucket.max,
    ).length;
    return { ...bucket, count };
  });
  const maxBucket = Math.max(1, ...scoreBuckets.map((b) => b.count));

  return (
    <div className="space-y-8">
      {scores.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: t("pages.profile.progressPours"),
                value: String(progressStats.count),
              },
              {
                label: t("pages.profile.progressBest"),
                value: progressStats.best.toFixed(2),
              },
              {
                label: t("pages.profile.progressAvg"),
                value: progressStats.avg.toFixed(2),
              },
              {
                label: t("pages.profile.progressLast7"),
                value: String(progressStats.last7),
              },
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
                      <span className="type-meta text-guinness-tan/70">
                        {t("pages.profile.progressAverage")}
                      </span>
                      <span className="text-3xl font-bold tabular-nums text-guinness-gold">
                        {progressStats.avg.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="type-meta text-center text-guinness-tan/75">
                  {t("pages.profile.progressLast7Pour")}{" "}
                  <span className="font-semibold text-guinness-cream">
                    {progressStats.last7}
                  </span>{" "}
                  {t("pages.profile.progressPoursSuffix")}
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: t("pages.profile.progressAverage"),
                    value: progressStats.avg,
                    accent: "bg-guinness-gold",
                  },
                  {
                    label: t("pages.profile.progressBest"),
                    value: progressStats.best,
                    accent: "bg-[#322914] ring-1 ring-guinness-gold/25",
                  },
                  {
                    label: t("pages.profile.progressRecentVolume"),
                    value: Math.min(progressStats.last7, 5),
                    accent: "bg-guinness-tan",
                    suffix: t("pages.profile.progressVolume7dSuffix", {
                      count: String(progressStats.last7),
                    }),
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-guinness-cream">
                        {item.label}
                      </span>
                      <span className="type-meta text-guinness-tan/70">
                        {item.value.toFixed(2)}
                        {item.suffix ?? t("pages.profile.progressOutOfFiveMax")}
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

          <section className="rounded-2xl border border-[#322914] bg-guinness-brown/30 p-4 sm:p-6">
            <h2 className="type-card-title">{t("pages.profile.gamificationTitle")}</h2>
            <p className="type-meta mt-1 text-guinness-tan/70">
              {t("pages.profile.gamificationBlurb")}
            </p>
            <div className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
              {achievements.map((badge) => (
                <div
                  key={badge.key}
                  className={`min-w-[76%] snap-start rounded-xl border px-4 py-3 sm:min-w-0 ${
                    badge.unlocked
                      ? "border-guinness-gold/35 bg-guinness-gold/10"
                      : "border-[#322914] bg-guinness-black/35"
                  }`}
                >
                  <p className="text-sm font-semibold text-guinness-cream">{badge.label}</p>
                  <p className="type-meta mt-1 text-guinness-tan/70">
                    {badge.unlocked
                      ? t("pages.profile.badgeUnlocked")
                      : t("pages.profile.badgeLocked")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#322914] bg-guinness-brown/30 p-4 sm:p-6">
            <h2 className="type-card-title">{t("pages.profile.analyticsTitle")}</h2>
            <div className="mt-4 grid gap-2 grid-cols-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[#322914] bg-guinness-black/35 p-4">
                <p className="type-meta text-guinness-tan/70">
                  {t("pages.profile.analyticsAverageScore")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">
                  {averageScore.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl border border-[#322914] bg-guinness-black/35 p-4">
                <p className="type-meta text-guinness-tan/70">
                  {t("pages.profile.analyticsTotalPints")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">
                  {totalPints}
                </p>
              </div>
              <div className="rounded-xl border border-[#322914] bg-guinness-black/35 p-4">
                <p className="type-meta text-guinness-tan/70">
                  {t("pages.profile.analyticsMostVisitedPub")}
                </p>
                <p className="mt-1 text-sm font-semibold text-guinness-cream">
                  {mostVisitedPubEntry
                    ? `${mostVisitedPubEntry.name} (${mostVisitedPubEntry.count})`
                    : t("pages.profile.analyticsNotEnoughData")}
                </p>
              </div>
              <div className="rounded-xl border border-[#322914] bg-guinness-black/35 p-4">
                <p className="type-meta text-guinness-tan/70">
                  {t("pages.profile.analyticsStreaks")}
                </p>
                <p className="mt-1 text-sm font-semibold text-guinness-cream">
                  {t("pages.profile.analyticsStreakValues", {
                    day: String(streakDaily),
                    week: String(streakWeekly),
                    weekend: String(streakWeekend),
                  })}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#322914] bg-guinness-brown/30 p-4 sm:p-6">
            <h2 className="type-card-title">{t("pages.profile.scoreHistoryTitle")}</h2>
            <p className="type-meta mt-1 text-guinness-tan/70">
              {t("pages.profile.scoreHistoryBlurb")}
            </p>
            <div className="mt-4 rounded-xl border border-[#322914] bg-guinness-black/40 p-3 sm:p-4">
              <svg viewBox="0 0 100 100" className="h-44 w-full" role="img" aria-label="score trend chart">
                <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(213,178,99,0.25)" strokeWidth="1" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(213,178,99,0.18)" strokeWidth="1" />
                <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(213,178,99,0.12)" strokeWidth="1" />
                {trendPoints ? (
                  <polyline
                    fill="none"
                    stroke="rgba(213,178,99,0.95)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={trendPoints}
                  />
                ) : null}
              </svg>
            </div>
            <div className="mt-4 rounded-xl border border-[#322914] bg-guinness-black/30 p-3">
              <p className="type-meta text-guinness-tan/65">
                {t("pages.profile.scoreDistributionTitle")}
              </p>
              <div className="mt-2 space-y-2">
                {scoreBuckets.map((bucket) => (
                  <div key={bucket.key} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-2">
                    <span className="text-xs tabular-nums text-guinness-tan/80">{bucket.key}</span>
                    <div className="h-2.5 overflow-hidden rounded-full border border-[#322914] bg-guinness-black/50">
                      <div
                        className="h-full rounded-full bg-guinness-gold"
                        style={{ width: `${Math.max(6, (bucket.count / maxBucket) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-guinness-tan/80">{bucket.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#322914] bg-guinness-brown/30 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="type-card-title">
                  {t("pages.profile.progressFriendLeaderboard")}
                </h2>
                <p className="type-meta mt-1 text-guinness-tan/70">
                  {t("pages.profile.progressFriendLeaderboardBlurb")}
                </p>
              </div>
              <SegmentedTabs
                value={progressRange}
                onValueChange={(v) => setProgressRange(v as ProgressRange)}
                items={progressRangeOptions.map((option) => ({
                  value: option.value,
                  label: progressTabLabel[option.value],
                }))}
                layoutClassName="flex w-full min-w-0 sm:flex-1"
                aria-label={t("pages.profile.progressTimeRangeAria")}
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
                        {entry.isCurrentUser ? t("pages.profile.progressYouSuffix") : ""}
                      </p>
                      <p className="type-meta truncate text-guinness-tan/60">{entry.email}</p>
                    </div>
                    <span className="text-sm tabular-nums text-guinness-tan/80 sm:text-right">
                      {t("pages.profile.progressLeaderboardPours", {
                        count: String(entry.pours),
                      })}
                    </span>
                    <span className="hidden text-sm tabular-nums text-guinness-tan/80 sm:block">
                      {t("pages.profile.progressRowAvgShort", {
                        value: entry.avg.toFixed(2),
                      })}
                    </span>
                    <span className="hidden text-sm tabular-nums text-guinness-tan/80 sm:block">
                      {t("pages.profile.progressRowBestShort", {
                        value: entry.best.toFixed(2),
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="type-meta mt-5 text-guinness-tan/70">
                {t("pages.profile.progressEmptyLeaderboardHint")}
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="type-meta text-guinness-tan/70">
          {t("pages.profile.progressNoScoresClaimBlurb")}
        </p>
      )}
    </div>
  );
}
