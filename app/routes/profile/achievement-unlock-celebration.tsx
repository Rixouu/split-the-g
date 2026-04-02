"use client";

import { Crown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, useOptionalLang } from "~/i18n/context";
import {
  defByPersistCode,
  profileAchievementTitleKey,
  sortPersistCodesByAchievementOrder,
  stickerSrc,
} from "./profile-achievements";
import { shareUnlockedAchievement } from "./profile-share-achievement";

const STORAGE_PREFIX = "stg_profile_ach_seen_v1_";

function readSeenCodes(userId: string): string[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((c) => String(c).trim()).filter(Boolean)
      : null;
  } catch {
    return null;
  }
}

function writeSeenCodes(userId: string, codes: readonly string[]) {
  const unique = [...new Set(codes)].sort();
  window.localStorage.setItem(
    `${STORAGE_PREFIX}${userId}`,
    JSON.stringify(unique),
  );
}

function baselineSeenIfNeeded(userId: string, currentCodes: readonly string[]) {
  const key = `${STORAGE_PREFIX}${userId}`;
  if (window.localStorage.getItem(key) != null) return;
  writeSeenCodes(userId, currentCodes);
}

function appendSeenCode(userId: string, code: string) {
  const prev = readSeenCodes(userId) ?? [];
  writeSeenCodes(userId, [...prev, code]);
}

export interface AchievementUnlockCelebrationProps {
  userId: string | null;
  persistedAchievementCodes: readonly string[];
  /** Profile fetch finished for this user (achievements + scores state consistent). */
  profileDataReady: boolean;
  showToast: (message: string | null, title?: string) => void;
}

export function AchievementUnlockCelebration({
  userId,
  persistedAchievementCodes,
  profileDataReady,
  showToast,
}: AchievementUnlockCelebrationProps) {
  const { t } = useI18n();
  const lang = useOptionalLang();
  const [queue, setQueue] = useState<string[]>([]);

  const codesFingerprint = useMemo(
    () => [...persistedAchievementCodes].sort().join("\0"),
    [persistedAchievementCodes],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !userId || !profileDataReady) return;
    baselineSeenIfNeeded(userId, persistedAchievementCodes);
    const seen = readSeenCodes(userId);
    if (seen == null) return;
    const seenSet = new Set(seen);
    const fresh = sortPersistCodesByAchievementOrder(
      persistedAchievementCodes.filter((c) => !seenSet.has(c)),
    );
    if (fresh.length === 0) return;
    setQueue((prev) => {
      const next = new Set(prev);
      for (const c of fresh) next.add(c);
      return sortPersistCodesByAchievementOrder([...next]);
    });
  }, [userId, profileDataReady, codesFingerprint, persistedAchievementCodes]);

  const activeCode = queue[0] ?? null;
  const def = activeCode ? defByPersistCode(activeCode) : undefined;
  const open = Boolean(def);

  const dismissCurrent = useCallback(() => {
    if (!userId || !activeCode) return;
    appendSeenCode(userId, activeCode);
    setQueue((q) => q.slice(1));
  }, [userId, activeCode]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissCurrent();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissCurrent]);

  const handleShare = useCallback(async () => {
    if (!def) return;
    const name = t(profileAchievementTitleKey(def.uiKey));
    await shareUnlockedAchievement(
      lang,
      t,
      name,
      () =>
        showToast(
          t("pages.profile.achievementShareCopied"),
          t("toasts.toastInfoTitle"),
        ),
      () =>
        showToast(
          t("pages.profile.achievementShareFailed"),
          t("toasts.toastWarningTitle"),
        ),
    );
  }, [def, lang, showToast, t]);

  if (!open || !def) return null;

  const sticker = stickerSrc(def.stickerNum);
  const achievementName = t(profileAchievementTitleKey(def.uiKey));

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label={t("pages.profile.close")}
        className="absolute inset-0 bg-guinness-black/80 backdrop-blur-sm transition-opacity duration-200 animate-branded-backdrop-in"
        onClick={() => dismissCurrent()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-unlock-title"
        className="relative z-10 w-full max-w-md animate-branded-panel-in rounded-2xl border border-guinness-gold/30 bg-gradient-to-b from-guinness-brown via-guinness-brown/95 to-guinness-black shadow-[0_24px_64px_rgba(0,0,0,0.65),0_0_0_1px_rgba(197,160,89,0.12)]"
      >
        <div
          className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-guinness-gold/90 to-guinness-gold/40"
          aria-hidden
        />
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-gold/65">
            {t("pages.profile.achievementUnlockKicker")}
          </p>
          <h2
            id="achievement-unlock-title"
            className="mt-2 text-center type-card-title text-xl text-guinness-gold sm:text-2xl"
          >
            {t("pages.profile.achievementUnlockTitle")}
          </h2>
          <div className="mt-5 flex flex-col items-center gap-3">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-guinness-gold/30 bg-guinness-black/45 px-2.5 py-1 text-guinness-gold shadow-[0_0_12px_rgba(212,175,55,0.08)]"
              title={t("pages.profile.badgeRankTitle", { tier: String(def.tierRank) })}
            >
              <Crown
                className="h-3.5 w-3.5 shrink-0 fill-guinness-gold/85 text-guinness-gold"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="text-[11px] font-bold tabular-nums">
                {def.tierRank}
              </span>
            </span>
            <img
              src={sticker}
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain drop-shadow-[0_0_16px_rgba(212,175,55,0.2)]"
            />
            <p className="text-center text-base font-semibold leading-snug text-guinness-cream">
              {achievementName}
            </p>
            <p className="text-center type-body-muted text-sm text-guinness-tan/75">
              {t("pages.profile.achievementUnlockBlurb")}
            </p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => dismissCurrent()}
              className="w-full rounded-xl border border-guinness-gold/35 bg-guinness-black/50 py-3 text-sm font-semibold text-guinness-tan transition-colors hover:border-guinness-gold/55 hover:bg-guinness-brown/55 hover:text-guinness-cream sm:w-auto sm:px-5"
            >
              {t("pages.profile.achievementUnlockClose")}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="w-full rounded-xl bg-guinness-gold py-3 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan sm:w-auto sm:px-5"
            >
              {t("pages.profile.achievementUnlockShare")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
