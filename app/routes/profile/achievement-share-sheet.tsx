"use client";

import { Copy, Crown, Share2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import { useI18n, useOptionalLang } from "~/i18n/context";
import { buildAchievementSharePayload } from "./profile-share-achievement";

export interface AchievementShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievementLabel: string | null;
  /** Sticker image URL (e.g. `/icons/stickers/009-beer.svg`). */
  stickerSrc: string | null;
  tierRank?: number;
  onCopySuccess: () => void;
  onCopyFail: () => void;
}

export function AchievementShareSheet({
  open,
  onOpenChange,
  achievementLabel,
  stickerSrc,
  tierRank,
  onCopySuccess,
  onCopyFail,
}: AchievementShareSheetProps) {
  const { t } = useI18n();
  const lang = useOptionalLang();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const canShare =
    typeof navigator !== "undefined" && Boolean(navigator.share);

  const handlePrimaryShare = useCallback(async () => {
    if (!achievementLabel) return;
    const payload = buildAchievementSharePayload(lang, t, achievementLabel);
    if (canShare) {
      try {
        await navigator.share(payload);
        onOpenChange(false);
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(payload.url);
      onCopySuccess();
      onOpenChange(false);
    } catch {
      onCopyFail();
    }
  }, [
    achievementLabel,
    canShare,
    lang,
    onCopyFail,
    onCopySuccess,
    onOpenChange,
    t,
  ]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open || !achievementLabel) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden" role="presentation">
      <button
        type="button"
        className="animate-branded-backdrop-in absolute inset-0 bg-guinness-black/75 backdrop-blur-[2px]"
        aria-label={t("pages.profile.achievementShareSheetBackdropLabel")}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-achievement-share-sheet-in absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px)+8.5rem)] left-0 right-0 flex max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-11.5rem))] flex-col overflow-hidden rounded-2xl border border-guinness-gold/25 bg-gradient-to-b from-guinness-brown/95 via-guinness-black/98 to-guinness-black shadow-[0_12px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(212,175,55,0.12)]"
      >
        <div className="flex justify-center pt-1.5 pb-0.5" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-guinness-gold/35" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-guinness-gold/10 px-4 py-2">
          <p
            id={titleId}
            className="text-xs font-semibold uppercase tracking-[0.22em] text-guinness-gold/65"
          >
            {t("pages.profile.achievementShareSheetKicker")}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-guinness-gold/30 text-guinness-gold transition-colors hover:border-guinness-gold/50 hover:bg-guinness-gold/10"
            aria-label={t("pages.profile.achievementShareSheetClose")}
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="shrink-0 px-4 pt-8 pb-0">
          <div
            className="relative mx-auto w-full max-w-[min(320px,94vw)] overflow-hidden rounded-2xl border border-guinness-gold/40 bg-gradient-to-b from-[#1f1a12] via-guinness-black to-[#0a0906] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(212,175,55,0.2),0_0_0_1px_rgba(42,34,17,0.9)]"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-guinness-gold/12 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-guinness-gold/8 blur-2xl"
              aria-hidden
            />
            <div className="relative rounded-[0.875rem] border border-guinness-gold/15 bg-guinness-black/40 px-4 pb-4 pt-4">
              <div className="flex w-full justify-center px-0.5">
                <SplitTheGLogo className="max-w-[min(220px,78vw)]" />
              </div>
              <div className="relative mt-3 flex flex-col items-center text-center">
                {typeof tierRank === "number" && tierRank > 0 ? (
                  <span
                    className="mb-2 inline-flex items-center gap-1 rounded-full border border-guinness-gold/35 bg-guinness-black/60 px-2.5 py-1 text-guinness-gold shadow-[0_0_14px_rgba(212,175,55,0.12)]"
                    title={t("pages.profile.badgeRankTitle", {
                      tier: String(tierRank),
                    })}
                  >
                    <Crown
                      className="h-3.5 w-3.5 shrink-0 fill-guinness-gold/85 text-guinness-gold"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="text-[11px] font-bold tabular-nums">
                      {tierRank}
                    </span>
                  </span>
                ) : null}
                {stickerSrc ? (
                  <img
                    src={stickerSrc}
                    alt=""
                    width={112}
                    height={112}
                    className="h-[6.25rem] w-[6.25rem] object-contain drop-shadow-[0_0_22px_rgba(212,175,55,0.26)]"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-[6.25rem] w-[6.25rem] items-center justify-center rounded-xl border border-dashed border-guinness-gold/25 bg-guinness-black/50 text-xs text-guinness-tan/50">
                    {t("pages.profile.achievementShareCardNoSticker")}
                  </div>
                )}
                <p className="mt-2.5 text-center text-[1.05rem] font-semibold leading-snug text-guinness-cream">
                  {achievementLabel}
                </p>
                <p className="mt-2 rounded-full border border-guinness-gold/25 bg-guinness-gold/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-guinness-gold">
                  {t("pages.profile.badgeUnlocked")}
                </p>
              </div>
            </div>
          </div>
          <p className="type-meta mx-auto mt-4 mb-8 max-w-[min(320px,94vw)] text-center text-[11px] leading-snug text-guinness-tan/60">
            {t("pages.profile.achievementShareSheetBlurb")}
          </p>
        </div>

        <div className="shrink-0 border-t border-guinness-gold/10 px-4 pt-4 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={() => void handlePrimaryShare()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-guinness-gold py-3 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan active:scale-[0.99]"
          >
            {canShare ? (
              <Share2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            ) : (
              <Copy className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            {canShare
              ? t("pages.profile.achievementShareSheetNativeSocials")
              : t("pages.profile.achievementShareSheetCopyLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
