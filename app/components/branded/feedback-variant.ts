import type { BrandedNoticeVariant } from "./BrandedNotice";

export function feedbackVariantFromMessage(message: string): BrandedNoticeVariant {
  const lower = message.toLowerCase();
  if (
    message === "Profile saved." ||
    lower.includes("signed out successfully") ||
    lower.includes("friend request sent") ||
    lower.includes("invite email sent again") ||
    lower.includes("competition invite sent") ||
    lower.includes("score claimed successfully") ||
    lower.includes("you're now friends") ||
    lower.includes("you’re now friends") ||
    lower.includes("favorite saved") ||
    lower.includes("friend request accepted")
  ) {
    return "success";
  }
  if (
    lower.includes("friend request declined") ||
    lower.includes("friend removed") ||
    lower.includes("favorite removed")
  ) {
    return "info";
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
  if (variant === "info") return 5000;
  if (variant === "warning") return 7000;
  return undefined;
}

export function scorePageFeedbackVariant(text: string): BrandedNoticeVariant {
  const t = text.toLowerCase();
  if (
    t.includes("successfully") ||
    t.includes("added to competition") ||
    t.includes("rating saved") ||
    t.includes("score unclaimed")
  ) {
    return "success";
  }
  if (
    t.includes("couldn't start") ||
    t.includes("couldn’t start") ||
    t.includes("didn't start")
  ) {
    return "danger";
  }
  if (t.includes("sign in") || t.includes("sign-in")) return "warning";
  return "danger";
}

export function competitionDetailMessageVariant(
  text: string,
): BrandedNoticeVariant {
  if (text.startsWith("Sign in")) return "warning";
  if (text.includes("has finished") || text.includes("no longer active")) {
    return "info";
  }
  if (text.includes("email invite failed")) return "danger";
  if (
    text.includes("You're in") ||
    text.includes("You’re in") ||
    text.includes("left this competition") ||
    text.includes("submitted to this competition") ||
    text.includes("has started") ||
    text.includes("Friend request sent") ||
    text.includes("Friend request already pending")
  ) {
    return "success";
  }
  return "danger";
}
