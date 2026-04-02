import type { SupportedLocale } from "~/i18n/config";
import { localizePath } from "~/i18n/paths";
import type { TranslateFn } from "~/i18n/translate";

export function achievementSharePagePath(lang: SupportedLocale): string {
  return localizePath("/profile/achievements", lang);
}

/** Client-only: full URL to the achievements page for sharing. */
export function getAchievementShareUrl(lang: SupportedLocale): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${achievementSharePagePath(lang)}`;
}

export function buildAchievementSharePayload(
  lang: SupportedLocale,
  t: TranslateFn,
  achievementLabel: string,
): { title: string; text: string; url: string } {
  return {
    title: t("pages.profile.achievementUnlockTitle"),
    text: t("pages.profile.achievementShareText", { name: achievementLabel }),
    url: getAchievementShareUrl(lang),
  };
}

/**
 * Web Share API for a single unlocked achievement, with clipboard fallback.
 */
export async function shareUnlockedAchievement(
  lang: SupportedLocale,
  t: TranslateFn,
  achievementLabel: string,
  onCopySuccess: () => void,
  onCopyFail: () => void,
): Promise<void> {
  if (typeof window === "undefined") return;
  const { title, text, url } = buildAchievementSharePayload(
    lang,
    t,
    achievementLabel,
  );
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    onCopySuccess();
  } catch {
    onCopyFail();
  }
}
