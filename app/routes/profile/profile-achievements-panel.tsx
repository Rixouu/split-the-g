import { useMemo } from "react";
import { useI18n } from "~/i18n/context";
import { useProfileOutlet } from "./profile-context";
import {
  computeProfileAchievements,
  profileAchievementTitleKey,
  stickerSrc,
  type ComputedAchievement,
} from "./profile-achievements";
import {
  pourStreakCalendarDays,
  weekendStreakFromScores,
  weeklyStreakFromScores,
} from "./profile-shared";
import type { TranslateFn } from "~/i18n/translate";

function achievementProgressCaption(
  c: ComputedAchievement,
  t: TranslateFn,
): string {
  switch (c.progressKind) {
    case "pours":
      return t("pages.profile.badgeProgressPours", {
        current: String(Math.min(c.progressTarget, Math.floor(c.progressCurrent))),
        target: String(c.progressTarget),
      });
    case "pubs":
      return t("pages.profile.badgeProgressPubs", {
        current: String(Math.min(c.progressTarget, Math.floor(c.progressCurrent))),
        target: String(c.progressTarget),
      });
    case "weekendStreak":
      return t("pages.profile.badgeProgressWeekends", {
        current: String(Math.min(c.progressTarget, Math.floor(c.progressCurrent))),
        target: String(c.progressTarget),
      });
    case "weeklyStreak":
      return t("pages.profile.badgeProgressWeeks", {
        current: String(Math.min(c.progressTarget, Math.floor(c.progressCurrent))),
        target: String(c.progressTarget),
      });
    case "dailyStreak":
      return t("pages.profile.badgeProgressDays", {
        current: String(Math.min(c.progressTarget, Math.floor(c.progressCurrent))),
        target: String(c.progressTarget),
      });
    case "bestScore":
      return t("pages.profile.badgeProgressBest", {
        best: c.bestScore.toFixed(2),
        target: c.progressTarget.toFixed(2),
      });
    case "binary":
      return t("pages.profile.badgeProgressEarly");
    case "elite":
      return t("pages.profile.badgeProgressElite", {
        pours: String(c.progressCurrent),
        avg: c.averageScore.toFixed(2),
      });
    default:
      return "";
  }
}

export function ProfileAchievementsPanel() {
  const { t } = useI18n();
  const { scores, persistedAchievementCodes, streakSnapshot } = useProfileOutlet();

  const weekendStreak = weekendStreakFromScores(scores);
  const streakDaily = streakSnapshot?.daily ?? pourStreakCalendarDays(scores);
  const weeklyStreak = streakSnapshot?.weekly ?? weeklyStreakFromScores(scores);

  const achievementModels = useMemo(
    () =>
      computeProfileAchievements(
        scores,
        persistedAchievementCodes,
        streakDaily,
        weekendStreak,
        weeklyStreak,
      ),
    [
      scores,
      persistedAchievementCodes,
      streakDaily,
      weekendStreak,
      weeklyStreak,
    ],
  );

  return (
    <section
      id="profile-achievements"
      className="scroll-mt-6 rounded-2xl border border-[#322914] bg-guinness-brown/30 p-4 sm:p-6"
    >
      <h1 className="type-card-title">{t("pages.profile.gamificationTitle")}</h1>
      <p className="type-meta mt-1 text-guinness-tan/70">
        {t("pages.profile.gamificationBlurb")}
      </p>
      <div className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
        {achievementModels.map((row) => {
          const label = t(profileAchievementTitleKey(row.def.uiKey));
          const src = stickerSrc(row.def.stickerNum);
          const barWidth = row.unlocked ? 100 : row.progressPercent;
          return (
            <div
              key={row.def.persistCode}
              className={`flex min-w-[82%] snap-start flex-col rounded-xl border px-4 py-3 sm:min-w-0 ${
                row.unlocked
                  ? "border-guinness-gold/35 bg-guinness-gold/10"
                  : "border-[#322914] bg-guinness-black/35"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-guinness-gold/30 bg-guinness-black/45 px-2 py-0.5 text-guinness-gold shadow-[0_0_12px_rgba(212,175,55,0.08)]"
                  title={t("pages.profile.badgeRankTitle", {
                    tier: String(row.def.tierRank),
                  })}
                  aria-label={t("pages.profile.badgeRankAria", {
                    tier: String(row.def.tierRank),
                  })}
                >
                  <span
                    className="stg-nav-icon stg-nav-icon--rank h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  />
                  <span className="text-[11px] font-bold tabular-nums">
                    {row.def.tierRank}
                  </span>
                </span>
                <img
                  src={src}
                  alt=""
                  width={56}
                  height={56}
                  className={`h-14 w-14 shrink-0 object-contain ${
                    row.unlocked
                      ? "drop-shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                      : "opacity-[0.3] grayscale"
                  }`}
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug text-guinness-cream">
                {label}
              </p>
              <p className="type-meta mt-1 text-guinness-tan/70">
                {row.unlocked
                  ? t("pages.profile.badgeUnlocked")
                  : t("pages.profile.badgeLocked")}
              </p>
              {!row.unlocked ? (
                <p className="type-meta mt-1 text-[11px] leading-relaxed text-guinness-tan/55">
                  {achievementProgressCaption(row, t)}
                </p>
              ) : null}
              <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#322914]/80 bg-guinness-black/60">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    row.unlocked ? "bg-guinness-gold" : "bg-guinness-gold/70"
                  }`}
                  style={{
                    width: `${Math.max(4, Math.min(100, barWidth))}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
