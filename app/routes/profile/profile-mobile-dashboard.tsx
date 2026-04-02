import type { User } from "@supabase/supabase-js";
import { Trophy } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { AppLink } from "~/i18n/app-link";
import { useI18n } from "~/i18n/context";
import type { TranslateFn } from "~/i18n/translate";
import { homePourButtonClass } from "~/components/PageHeader";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";
import { achievementHubSummaryFromSnapshot } from "./profile-achievements";
import type { StreakSnapshot } from "./profile-context";
import {
  buildFriendLeaderboard,
  emailDisplayName,
  normalizeEmail,
  pourStreakCalendarDays,
  progressRangeStart,
  type ComparisonScoreRow,
  type FavoriteRow,
  type ScoreSummary,
  type UserFriendRow,
} from "./profile-shared";

/** Matches stroke used elsewhere (e.g. feed cards, competition rows). */
const MOBILE_PROFILE_STROKE = "border-[#2A2211]";

function ChevronRightIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={props.className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Google / Supabase OAuth often expose `picture` or `avatar_url` on metadata or identities. */
function oauthProfilePictureUrl(user: User): string | undefined {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  for (const key of ["avatar_url", "picture"] as const) {
    const v = meta?.[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const id of user.identities ?? []) {
    const d = id.identity_data as Record<string, unknown> | undefined;
    if (!d) continue;
    for (const key of ["avatar_url", "picture"] as const) {
      const v = d[key];
      if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
    }
  }
  return undefined;
}

function DefaultProfileAvatarIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-8.433.649A7.23 7.23 0 005.25 12a7.23 7.23 0 011-3.746 7.204 7.204 0 0115.002 0 7.23 7.23 0 011 3.746 7.23 7.23 0 01-5.002 6.746zM16.706 9.706a4.25 4.25 0 11-8.5 0 4.25 4.25 0 018.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

interface ProfileMobileGuestHubProps {
  onSignInGoogle: () => void;
}

export function ProfileMobileGuestHub({
  onSignInGoogle,
}: ProfileMobileGuestHubProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-6 md:hidden">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-gold/55">
        {t("pages.profile.mobileGuestKicker")}
      </p>
      <div className="relative overflow-hidden rounded-2xl border border-guinness-gold/25 bg-gradient-to-b from-guinness-brown/50 to-guinness-black/80 p-6 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-guinness-gold/10 blur-2xl" />
        <h2 className="type-display text-2xl text-guinness-gold">
          {t("pages.profile.mobileGuestTitle")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-guinness-tan/80">
          {t("pages.profile.mobileGuestBlurb")}
        </p>
        <button
          type="button"
          onClick={onSignInGoogle}
          className="mt-6 w-full rounded-xl border border-guinness-gold/50 bg-guinness-gold/15 py-3.5 text-sm font-semibold text-guinness-cream transition-colors hover:border-guinness-gold/75 hover:bg-guinness-gold/25"
        >
          {t("pages.profile.signInGoogle")}
        </button>
        <p className="type-meta mt-5 text-center text-guinness-tan/70">
          <AppLink
            to="/profile/faq"
            prefetch="intent"
            viewTransition
            className="font-semibold text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 hover:text-guinness-tan"
          >
            {t("pages.profile.navFaq")}
          </AppLink>
          <span className="text-guinness-tan/55">
            {t("pages.profile.faqLinkBlurb")}
          </span>
        </p>
      </div>
      <div className="rounded-2xl border border-guinness-gold/15 bg-guinness-brown/25 px-4 py-5 opacity-75">
        <p className="text-center text-xs text-guinness-tan/55">
          {t("pages.profile.mobileGuestTeaser")}
        </p>
      </div>
    </div>
  );
}

interface ProfileMobileSignedInHubProps {
  user: User;
  fullName: string;
  nickname: string;
  /** ISO 3166-1 alpha-2 from profile; drives flag on Scores row */
  countryCode: string;
  scores: ScoreSummary[];
  favorites: FavoriteRow[];
  acceptedFriends: UserFriendRow[];
  comparisonScores: ComparisonScoreRow[];
  comparisonLabels: Record<string, string>;
  incomingFriendRequestCount: number;
  outgoingFriendPendingCount: number;
  persistedAchievementCodes: string[];
  streakSnapshot: StreakSnapshot | null;
}

function friendsHubSubtitle(
  t: TranslateFn,
  friendCount: number,
  incoming: number,
  outgoing: number,
): string {
  if (incoming > 0 && outgoing > 0) {
    return t("pages.profile.mobileHubFriendsSubBoth", {
      count: friendCount,
      incoming,
      outgoing,
    });
  }
  if (incoming > 0) {
    return t("pages.profile.mobileHubFriendsSubIncoming", {
      count: friendCount,
      incoming,
    });
  }
  if (outgoing > 0) {
    return t("pages.profile.mobileHubFriendsSubOutgoing", {
      count: friendCount,
      outgoing,
    });
  }
  return t("pages.profile.mobileHubFriendsSubOnly", { count: friendCount });
}

export function ProfileMobileSignedInHub({
  user,
  fullName,
  nickname,
  countryCode,
  scores,
  favorites,
  acceptedFriends,
  comparisonScores,
  comparisonLabels,
  incomingFriendRequestCount,
  outgoingFriendPendingCount,
  persistedAchievementCodes,
  streakSnapshot,
}: ProfileMobileSignedInHubProps) {
  const { t } = useI18n();
  const email = user.email ?? "";
  const displayName =
    fullName.trim() ||
    (email ? emailDisplayName(email) : t("pages.profile.defaultPlayerFallback"));
  const handle =
    nickname.trim() !== ""
      ? `@${nickname.trim()}`
      : email
        ? `@${emailDisplayName(email)}`
        : "";
  const memberYear = user.created_at
    ? new Date(user.created_at).getFullYear()
    : null;

  const pourCount = scores.length;
  const totalPoints = scores.reduce((a, s) => a + Number(s.split_score ?? 0), 0);
  const friendCount = acceptedFriends.length;
  const streak = pourStreakCalendarDays(scores);

  const achievementSummary = useMemo(
    () =>
      achievementHubSummaryFromSnapshot(
        scores,
        persistedAchievementCodes,
        streakSnapshot,
      ),
    [scores, persistedAchievementCodes, streakSnapshot],
  );

  const weekStart = progressRangeStart("7d");
  const weekComparisonRows =
    weekStart == null
      ? comparisonScores
      : comparisonScores.filter(
          (row) => new Date(row.created_at).getTime() >= weekStart,
        );
  const weekBoard = buildFriendLeaderboard(
    weekComparisonRows,
    comparisonLabels,
    email ? normalizeEmail(email) : null,
  );
  const allTimeBoard = buildFriendLeaderboard(
    comparisonScores,
    comparisonLabels,
    email ? normalizeEmail(email) : null,
  );

  const selfWeek = weekBoard.find((e) => e.isCurrentUser);
  const weekRank = selfWeek ? weekBoard.indexOf(selfWeek) + 1 : null;
  const aheadEntry =
    weekRank != null && weekRank > 1 ? weekBoard[weekRank - 2] : null;

  const selfAll = allTimeBoard.find((e) => e.isCurrentUser);
  const allRank = selfAll ? allTimeBoard.indexOf(selfAll) + 1 : null;

  const sortedFavs = [...favorites].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const lastFav = sortedFavs[0];
  const lastFavLabel = lastFav
    ? new Date(lastFav.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  const priced = scores.filter(
    (s) => s.pint_price != null && Number.isFinite(Number(s.pint_price)),
  );
  const totalSpend = priced.reduce((a, s) => a + Number(s.pint_price), 0);

  const statCardClass = `flex flex-1 flex-col items-center justify-center rounded-xl border ${MOBILE_PROFILE_STROKE} bg-guinness-brown/35 px-2 py-3.5 text-center`;

  const rowClass = `flex min-h-[4.25rem] items-center gap-3 rounded-xl border ${MOBILE_PROFILE_STROKE} bg-guinness-brown/30 px-4 py-3 transition-colors active:bg-guinness-brown/45`;

  const iconWellClass = `flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${MOBILE_PROFILE_STROKE} bg-guinness-black/40 text-guinness-gold`;

  const flagEmoji =
    countryCode && /^[A-Z]{2}$/i.test(countryCode)
      ? flagEmojiFromIso2(countryCode)
      : "";

  const avatarPhotoUrl = useMemo(() => oauthProfilePictureUrl(user), [user]);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const showGoogleAvatar = Boolean(avatarPhotoUrl) && !avatarLoadFailed;
  const tierRingUid = useId();
  const ringGradientId = `stg-tier-ring-${tierRingUid.replace(/:/g, "")}`;
  const totalAch = achievementSummary.totalCount;
  const unlockedAch = achievementSummary.unlockedCount;
  const ringCirc = 2 * Math.PI * 21;
  const ringFillRatio =
    totalAch > 0
      ? Math.min(1, Math.max(0.06, unlockedAch / totalAch))
      : 0.1;
  const ringDash = ringFillRatio * ringCirc;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarPhotoUrl, user.id]);

  return (
    <div className="space-y-6 md:hidden">
      <header className="flex gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="relative h-[4.25rem] w-[4.25rem] shrink-0"
            aria-hidden
          >
            <svg
              className="absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 72 72"
              fill="none"
              aria-hidden
            >
              <defs>
                <linearGradient
                  id={ringGradientId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgb(212 175 55)" stopOpacity="0.95" />
                  <stop offset="55%" stopColor="rgb(245 220 140)" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="rgb(180 140 50)" stopOpacity="0.75" />
                </linearGradient>
              </defs>
              <circle
                cx="36"
                cy="36"
                r="21"
                stroke="rgba(42,34,17,0.9)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="36"
                cy="36"
                r="21"
                stroke={`url(#${ringGradientId})`}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ringDash} ${ringCirc}`}
                className="drop-shadow-[0_0_6px_rgba(212,175,55,0.35)]"
              />
            </svg>
            <div
              className={`absolute left-1/2 top-1/2 h-[3.15rem] w-[3.15rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 ${MOBILE_PROFILE_STROKE} bg-guinness-brown/45 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.12)]`}
            >
              {showGoogleAvatar ? (
                <img
                  key={avatarPhotoUrl}
                  src={avatarPhotoUrl}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-guinness-gold/45">
                  <DefaultProfileAvatarIcon className="h-7 w-7" />
                </div>
              )}
            </div>
            {achievementSummary.unlockedCount > 0 &&
            achievementSummary.maxTierAmongUnlocked > 0 ? (
              <div
                className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 rounded-full border border-guinness-gold/40 bg-guinness-black/90 px-1 py-0.5 text-guinness-gold shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                title={t("pages.profile.mobileHubTierBadgeTitle", {
                  tier: String(achievementSummary.maxTierAmongUnlocked),
                })}
              >
                <span
                  className="stg-nav-icon stg-nav-icon--rank h-2.5 w-2.5 shrink-0"
                  aria-hidden
                />
                <span className="text-[9px] font-bold tabular-nums leading-none">
                  {achievementSummary.maxTierAmongUnlocked}
                </span>
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-gold/55">
              {t("pages.profile.mobileHubKicker")}
            </p>
            <p className="mt-1 flex min-w-0 items-center gap-2">
              {flagEmoji ? (
                <span
                  className="shrink-0 text-[1.35rem] leading-none"
                  title={countryCode.toUpperCase()}
                  aria-hidden
                >
                  {flagEmoji}
                </span>
              ) : null}
              <span className="truncate text-lg font-semibold leading-snug text-guinness-gold">
                {displayName}
              </span>
            </p>
            <p className="type-meta mt-0.5 truncate text-guinness-tan/65">
              {handle ? <span>{handle}</span> : null}
              {handle && memberYear != null ? (
                <span aria-hidden> · </span>
              ) : null}
              {memberYear != null ? (
                <span>
                  {t("pages.profile.mobileHubMemberSince", { year: memberYear })}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <AppLink
          to="/profile/account"
          prefetch="intent"
          viewTransition
          className={`shrink-0 self-start rounded-lg border ${MOBILE_PROFILE_STROKE} bg-guinness-black/35 px-3 py-1.5 text-xs font-semibold text-guinness-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.08)] transition-colors hover:border-guinness-gold/40 hover:bg-guinness-gold/10`}
        >
          {t("pages.profile.mobileHubEdit")}
        </AppLink>
      </header>

      <div className="flex gap-2">
        <div className={statCardClass}>
          <span className="text-lg font-bold tabular-nums text-guinness-gold">
            {pourCount.toLocaleString()}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-guinness-tan/55">
            {t("pages.profile.mobileHubStatPours")}
          </span>
        </div>
        <div className={statCardClass}>
          <span className="text-lg font-bold tabular-nums text-guinness-gold">
            {totalPoints.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-guinness-tan/55">
            {t("pages.profile.mobileHubStatScore")}
          </span>
        </div>
        <div className={statCardClass}>
          <span className="text-lg font-bold tabular-nums text-guinness-gold">
            {friendCount.toLocaleString()}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-guinness-tan/55">
            {t("pages.profile.mobileHubStatFriends")}
          </span>
        </div>
      </div>

      <AppLink
        to="/profile/progress"
        prefetch="intent"
        viewTransition
        className={`relative block overflow-hidden rounded-xl border ${MOBILE_PROFILE_STROKE} bg-guinness-brown/35 px-4 py-4 transition-colors hover:bg-guinness-brown/45`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-guinness-gold/55 to-transparent opacity-90"
          aria-hidden
        />
        <div className="relative flex items-start gap-3 pt-1">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${MOBILE_PROFILE_STROKE} bg-guinness-black/50 text-sm font-bold text-guinness-gold shadow-[0_0_12px_rgba(212,175,55,0.12)]`}
          >
            {weekRank != null ? weekRank : "—"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-guinness-cream">
              {t("pages.profile.mobileHubLeaderboardTitle")}
            </p>
            <p className="type-meta mt-1 text-guinness-tan/70">
              {weekBoard.length < 2
                ? t("pages.profile.mobileHubLeaderboardSolo")
                : selfWeek == null || selfWeek.pours === 0
                  ? t("pages.profile.mobileHubLeaderboardNoScores")
                  : weekRank === 1
                    ? t("pages.profile.mobileHubLeaderboardTop")
                    : aheadEntry
                      ? t("pages.profile.mobileHubLeaderboardBehind", {
                          rank: weekRank ?? undefined,
                          gap: (aheadEntry.avg - selfWeek.avg).toFixed(2),
                          name: aheadEntry.label,
                        })
                      : t("pages.profile.mobileHubLeaderboardRankOnly", {
                          rank: weekRank ?? undefined,
                        })}
            </p>
          </div>
        </div>
      </AppLink>

      <AppLink
        to="/"
        viewTransition
        className={`${homePourButtonClass} text-base`}
      >
        {t("common.pour")}
      </AppLink>

      <section aria-label={t("pages.profile.mobileHubActivityAria")}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-gold/55">
          {t("pages.profile.mobileHubActivityKicker")}
        </p>
        <ul className="space-y-2">
          <li>
            <AppLink
              to="/profile/progress"
              prefetch="intent"
              viewTransition
              className={rowClass}
            >
              <span className={iconWellClass} aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3v18h18M7 16l4-4 4 4 6-6"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navProgress")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {streak > 0
                    ? t("pages.profile.mobileHubProgressSub", {
                        count: pourCount,
                        streak,
                      })
                    : t("pages.profile.mobileHubProgressSubNoStreak", {
                        count: pourCount,
                      })}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
          <li>
            <AppLink
              to="/profile/achievements"
              prefetch="intent"
              viewTransition
              className={rowClass}
            >
              <span className={iconWellClass} aria-hidden>
                <Trophy className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navAchievements")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {t("pages.profile.mobileHubAchievementsSub", {
                    unlocked: achievementSummary.unlockedCount,
                    total: achievementSummary.totalCount,
                  })}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
          <li>
            <AppLink
              to="/profile/scores"
              prefetch="intent"
              viewTransition
              className={rowClass}
              title={
                flagEmoji ? undefined : t("pages.profile.mobileHubScoresFlagHint")
              }
            >
              <span
                className={`${iconWellClass} text-xl leading-none`}
                aria-hidden
              >
                {flagEmoji ? (
                  <span className="select-none">{flagEmoji}</span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    className="h-5 w-5 opacity-80"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                    />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navScores")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {allRank != null && allTimeBoard.length > 1
                    ? t("pages.profile.mobileHubScoresSub", {
                        total: totalPoints.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        }),
                        rank: allRank,
                      })
                    : t("pages.profile.mobileHubScoresSubSolo", {
                        total: totalPoints.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        }),
                      })}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-guinness-gold">
                {totalPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
          <li>
            <AppLink
              to="/profile/favorites"
              prefetch="intent"
              viewTransition
              className={rowClass}
            >
              <span className={iconWellClass} aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navFavorites")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {favorites.length > 0 && lastFavLabel
                    ? t("pages.profile.mobileHubFavoritesSub", {
                        count: favorites.length,
                        date: lastFavLabel,
                      })
                    : t("pages.profile.mobileHubFavoritesEmpty")}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
        </ul>
      </section>

      <section aria-label={t("pages.profile.mobileHubAccountAria")}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-gold/55">
          {t("pages.profile.mobileHubAccountKicker")}
        </p>
        <ul className="space-y-2">
          <li>
            <AppLink
              to="/profile/expenses"
              prefetch="intent"
              viewTransition
              className={rowClass}
            >
              <span className={iconWellClass} aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 3V9m0 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navExpenses")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {priced.length > 0
                    ? t("pages.profile.mobileHubExpensesSub", {
                        amount: totalSpend.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }),
                      })
                    : t("pages.profile.mobileHubExpensesEmpty")}
                </p>
              </div>
              {priced.length > 0 ? (
                <span className="shrink-0 text-sm font-bold tabular-nums text-guinness-gold">
                  {formatCompactNumber(totalSpend)}
                </span>
              ) : null}
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
          <li>
            <AppLink
              to="/profile/friends"
              prefetch="intent"
              viewTransition
              className={rowClass}
            >
              <span className={iconWellClass} aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navFriends")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {friendsHubSubtitle(
                    t,
                    friendCount,
                    incomingFriendRequestCount,
                    outgoingFriendPendingCount,
                  )}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
          <li>
            <AppLink
              to="/profile/faq"
              prefetch="intent"
              viewTransition
              className={rowClass}
            >
              <span className={iconWellClass} aria-hidden>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-guinness-cream">
                  {t("pages.profile.navFaq")}
                </p>
                <p className="type-meta text-guinness-tan/60">
                  {t("pages.profile.mobileHubFaqSub")}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-guinness-gold/70" />
            </AppLink>
          </li>
        </ul>
      </section>
    </div>
  );
}
