"use client";

import { Crown, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, useOptionalLang } from "~/i18n/context";
import { AchievementShareSheet } from "./achievement-share-sheet";
import { useProfileOutlet } from "./profile-context";
import {
  computeProfileAchievements,
  profileAchievementTitleKey,
  stickerSrc,
  type ComputedAchievement,
} from "./profile-achievements";
import { shareUnlockedAchievement } from "./profile-share-achievement";
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

function useNarrowAchievementShareViewport() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

export function ProfileAchievementsPanel() {
  const { t } = useI18n();
  const lang = useOptionalLang();
  const narrowViewport = useNarrowAchievementShareViewport();
  const [shareSheetTarget, setShareSheetTarget] = useState<{
    label: string;
    stickerSrc: string;
    tierRank: number;
  } | null>(null);
  const {
    scores,
    persistedAchievementCodes,
    streakSnapshot,
    showProfileToast,
  } = useProfileOutlet();

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

  const unlockedCount = useMemo(
    () => achievementModels.filter((r) => r.unlocked).length,
    [achievementModels],
  );
  const totalCount = achievementModels.length;

  const shareAchievement = useCallback(
    async (label: string) => {
      await shareUnlockedAchievement(
        lang,
        t,
        label,
        () =>
          showProfileToast(
            t("pages.profile.achievementShareCopied"),
            t("toasts.toastInfoTitle"),
          ),
        () =>
          showProfileToast(
            t("pages.profile.achievementShareFailed"),
            t("toasts.toastWarningTitle"),
          ),
      );
    },
    [lang, showProfileToast, t],
  );

  const openShareForLabel = useCallback(
    (label: string, sticker: string, tierRank: number) => {
      if (narrowViewport) {
        setShareSheetTarget({ label, stickerSrc: sticker, tierRank });
        return;
      }
      void shareAchievement(label);
    },
    [narrowViewport, shareAchievement],
  );

  return (
    <div className="space-y-5 md:space-y-6">
      <AchievementShareSheet
        open={shareSheetTarget != null}
        onOpenChange={(next) => {
          if (!next) setShareSheetTarget(null);
        }}
        achievementLabel={shareSheetTarget?.label ?? null}
        stickerSrc={shareSheetTarget?.stickerSrc ?? null}
        tierRank={shareSheetTarget?.tierRank}
        onCopySuccess={() =>
          showProfileToast(
            t("pages.profile.achievementShareCopied"),
            t("toasts.toastInfoTitle"),
          )
        }
        onCopyFail={() =>
          showProfileToast(
            t("pages.profile.achievementShareFailed"),
            t("toasts.toastWarningTitle"),
          )
        }
      />
      <div className="md:hidden">
        <div className="relative overflow-hidden rounded-2xl border border-guinness-gold/25 bg-gradient-to-b from-guinness-brown/55 via-guinness-black/80 to-guinness-black px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-guinness-gold/10 blur-3xl"
            aria-hidden
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-guinness-gold/60">
            {t("pages.profile.achievementsHeroKicker")}
          </p>
          <p className="mt-3 text-4xl font-bold tabular-nums text-guinness-gold">
            {unlockedCount}
            <span className="text-lg font-semibold text-guinness-tan/50">
              {" "}
              / {totalCount}
            </span>
          </p>
          <p className="mt-1 text-sm font-medium text-guinness-cream">
            {t("pages.profile.achievementsHeroCaption")}
          </p>
          <p className="type-meta mx-auto mt-3 max-w-sm text-guinness-tan/65">
            {t("pages.profile.achievementsPageBlurb")}
          </p>
        </div>
      </div>

      <section
        id="profile-achievements"
        className="scroll-mt-6 rounded-2xl border border-[#322914] bg-guinness-brown/30 p-4 sm:p-6 md:border-guinness-gold/15"
      >
        <div className="hidden md:block">
          <h1 className="type-card-title">{t("pages.profile.gamificationTitle")}</h1>
          <p className="type-meta mt-1 text-guinness-tan/70">
            {t("pages.profile.gamificationBlurb")}
          </p>
        </div>
        <div className="md:hidden">
          <h2 className="type-card-title text-lg">{t("pages.profile.gamificationTitle")}</h2>
          <p className="type-meta mt-1 text-guinness-tan/70">
            {t("pages.profile.gamificationBlurb")}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {achievementModels.map((row) => {
            const label = t(profileAchievementTitleKey(row.def.uiKey));
            const src = stickerSrc(row.def.stickerNum);
            const barWidth = row.unlocked ? 100 : row.progressPercent;
            const cardInner = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-guinness-gold/30 bg-guinness-black/45 px-2 py-0.5 text-guinness-gold shadow-[0_0_12px_rgba(212,175,55,0.08)]"
                    title={t("pages.profile.badgeRankTitle", {
                      tier: String(row.def.tierRank),
                    })}
                  >
                    <Crown
                      className="h-3 w-3 shrink-0 fill-guinness-gold/85 text-guinness-gold"
                      strokeWidth={1.75}
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
                ) : (
                  <p className="type-meta mt-2 flex items-center gap-1 text-[11px] font-medium text-guinness-gold/80">
                    <Share2 className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                    {t("pages.profile.badgeTapToShare")}
                  </p>
                )}
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
              </>
            );

            if (row.unlocked) {
              return (
                <button
                  key={row.def.persistCode}
                  type="button"
                  onClick={() =>
                    openShareForLabel(label, src, row.def.tierRank)
                  }
                  className={`flex min-h-0 flex-col rounded-xl border px-3 py-3 text-left transition-colors active:scale-[0.99] sm:px-4 ${
                    row.unlocked
                      ? "border-guinness-gold/40 bg-guinness-gold/10 hover:border-guinness-gold/60 hover:bg-guinness-gold/[0.14]"
                      : ""
                  }`}
                  aria-label={t("pages.profile.badgeShareAccessibility", {
                    name: label,
                  })}
                >
                  {cardInner}
                </button>
              );
            }

            return (
              <div
                key={row.def.persistCode}
                className="flex flex-col rounded-xl border border-[#322914] bg-guinness-black/35 px-3 py-3 sm:px-4"
              >
                {cardInner}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
