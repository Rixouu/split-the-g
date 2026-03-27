import type { BrandedNoticeVariant } from "./BrandedNotice";

export function feedbackVariantFromMessage(message: string): BrandedNoticeVariant {
  const lower = message.toLowerCase();
  if (
    message === "Profile saved." ||
    lower.includes("signed out successfully") ||
    lower.includes("friend request sent") ||
    lower.includes("invite email sent again") ||
    lower.includes("competition invite sent") ||
    lower.includes("score claimed successfully")
  ) {
    return "success";
  }
  if (
    message.startsWith("Request saved, but") ||
    lower.includes("email invite failed") ||
    lower.includes("email failed") ||
    (lower.includes("pending") && lower.includes("failed"))
  ) {
    return "warning";
  }
  return "danger";
}

export function toastAutoCloseForVariant(
  variant: BrandedNoticeVariant,
): number | undefined {
  if (variant === "success") return 4200;
  if (variant === "warning") return 7000;
  return undefined;
}

export function scorePageFeedbackVariant(text: string): BrandedNoticeVariant {
  const t = text.toLowerCase();
  if (
    t.includes("successfully") ||
    t.includes("added to competition") ||
    t.includes("rating saved")
  ) {
    return "success";
  }
  if (t.includes("sign in")) return "warning";
  return "danger";
}

export function competitionDetailMessageVariant(
  text: string,
): BrandedNoticeVariant {
  if (text.startsWith("Sign in")) return "warning";
  if (
    text.includes("You're in") ||
    text.includes("You’re in") ||
    text.includes("left this competition") ||
    text.includes("submitted to this competition")
  ) {
    return "success";
  }
  return "danger";
}
