import { Outlet, useLocation } from "react-router";
import { AppLink } from "~/i18n/app-link";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  EndPageNewPourFooter,
  PageHeader,
  homePourButtonClass,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { BrandedNotice } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import {
  feedbackVariantFromMessage,
  toastAutoCloseForVariant,
} from "~/components/branded/feedback-variant";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { isValidNickname } from "~/utils/profile-nickname";
import { NATIVE_SELECT_APPEARANCE_CLASS } from "~/utils/native-select-classes";
import {
  clearPostOAuthReturnIfMatchesCurrentPath,
  googleOAuthRedirectToSiteRoot,
  rememberPathBeforeGoogleOAuth,
} from "~/utils/post-oauth-return";
import { ProfilePageProvider } from "./profile-context";
import type { StreakSnapshot } from "./profile-context";
import type { ProfileLayoutOutletContext } from "./route-outlet-context";
import {
  SegmentedTabsNav,
  resolveProfileSectionTab,
} from "~/components/ui/segmented-tabs";
import {
  barKey,
  buildFriendLeaderboard,
  escapeIlikePattern,
  emailDisplayName,
  normalizeEmail,
  progressRangeStart,
  type ComparisonScoreRow,
  type FavoriteBarStats,
  type FavoriteRow,
  type FriendLeaderboardEntry,
  type FriendRequestRow,
  type ProgressRange,
  type PublicProfileRow,
  type ScoreSummary,
  type UserFriendRow,
} from "./profile-shared";
import {
  ProfileMobileGuestHub,
  ProfileMobileSignedInHub,
} from "./profile-mobile-dashboard";
import {
  flagEmojiFromIso2,
  getCountryOptions,
} from "~/utils/countryDisplay";
import { signOutToastFromT } from "~/i18n/auth-copy";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { stripLocalePrefix } from "~/i18n/paths";
import { useIsDesktopMd } from "~/utils/useDesktopMd";
import { PushNotificationsManager } from "~/components/PushNotificationsManager";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/progress", "profile");
}

export default function ProfileLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const profileNavItemsWithFaq = useMemo(
    () =>
      [
        { to: "/profile/account", label: t("pages.profile.navAccount") },
        { to: "/profile/progress", label: t("pages.profile.navProgress") },
        { to: "/profile/expenses", label: t("pages.profile.navExpenses") },
        { to: "/profile/scores", label: t("pages.profile.navScores") },
        { to: "/profile/favorites", label: t("pages.profile.navFavorites") },
        { to: "/profile/friends", label: t("pages.profile.navFriends") },
        { to: "/profile/faq", label: t("pages.profile.navFaq") },
      ] as const,
    [t],
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<ScoreSummary[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoriteStats, setFavoriteStats] = useState<Record<string, FavoriteBarStats>>(
    {},
  );
  const [favName, setFavName] = useState("");
  const [favAddress, setFavAddress] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [toastTitleOverride, setToastTitleOverride] = useState<
    string | undefined
  >();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const hideToast = useCallback(() => {
    setMessage(null);
    setToastTitleOverride(undefined);
  }, []);

  const showToast = useCallback(
    (msg: string | null, explicitTitle?: string) => {
      if (msg === null) {
        hideToast();
        return;
      }
      setMessage(msg);
      setToastTitleOverride(
        explicitTitle !== undefined ? explicitTitle : undefined,
      );
    },
    [hideToast],
  );
  const [busy, setBusy] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestRow[]>(
    [],
  );
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestRow[]>(
    [],
  );
  const [friends, setFriends] = useState<UserFriendRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  /** ISO 3166-1 alpha-2; empty = not set */
  const [countryCode, setCountryCode] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const countryOptions = useMemo(() => getCountryOptions(), []);

  const profileNavLinkItems = useMemo(
    () =>
      profileNavItemsWithFaq.map(({ to, label }) => ({
        value: to,
        to,
        label,
      })),
    [profileNavItemsWithFaq],
  );

  const profileSectionPaths = useMemo(
    () => profileNavItemsWithFaq.map((i) => i.to),
    [profileNavItemsWithFaq],
  );

  const pathTail =
    stripLocalePrefix(location.pathname).replace(/\/+$/, "") || "/";
  const isProfileHubPath = pathTail === "/profile";
  const isProfileFaqPath = pathTail === "/profile/faq";
  const hideEndPageNewPourFooter = isProfileHubPath || isProfileFaqPath;

  /** Hub path must not resolve to the first tab (Account); use Progress for data hints only. */
  const profileActiveSection = useMemo(() => {
    if (isProfileHubPath) return "/profile/progress";
    return resolveProfileSectionTab(pathTail, profileSectionPaths);
  }, [pathTail, profileSectionPaths, isProfileHubPath]);

  const isDesktop = useIsDesktopMd();
  const isMobileProfileHubDashboard =
    !isDesktop && Boolean(user) && isProfileHubPath && !loading;
  const isMobileProfileGuestHero = !isDesktop && !user && !loading;
  const showProfileHeaderPour =
    !user || isDesktop || isProfileHubPath;
  const mobileSubsectionTitle = useMemo(() => {
    const hit = profileNavItemsWithFaq.find(({ to }) => to === profileActiveSection);
    return hit?.label ?? t("pages.profile.title");
  }, [profileActiveSection, profileNavItemsWithFaq, t]);
  const profileHeaderTitle =
    user && !showProfileHeaderPour
      ? profileActiveSection === "/profile/faq"
        ? t("pages.profile.faqHeaderTitle")
        : mobileSubsectionTitle
      : t("pages.profile.title");
  const profileHeaderDescription =
    user && !showProfileHeaderPour ? undefined : t("pages.descriptions.profile");
  const showAccountFormSection =
    Boolean(user) && profileActiveSection === "/profile/account";
  const activeLoadOptions = useMemo(
    () => ({
      includeScores:
        profileActiveSection === "/profile/progress" ||
        profileActiveSection === "/profile/expenses" ||
        profileActiveSection === "/profile/scores",
      includeFavorites:
        profileActiveSection === "/profile/favorites" || isProfileHubPath,
      includeSocial:
        profileActiveSection === "/profile/friends" ||
        profileActiveSection === "/profile/progress",
    }),
    [profileActiveSection, isProfileHubPath],
  );
  const [progressRange, setProgressRange] = useState<ProgressRange>("30d");
  const [comparisonScores, setComparisonScores] = useState<ComparisonScoreRow[]>([]);
  const [comparisonLabels, setComparisonLabels] = useState<Record<string, string>>({});
  const [persistedAchievementCodes, setPersistedAchievementCodes] = useState<string[]>(
    [],
  );
  const [streakSnapshot, setStreakSnapshot] = useState<StreakSnapshot | null>(null);

  const progressStats = useMemo(() => {
    if (scores.length === 0) {
      return {
        count: 0,
        best: 0,
        avg: 0,
        last7: 0,
        dialPct: 0,
        totalSpend: 0,
      };
    }
    const best = Math.max(...scores.map((s) => s.split_score));
    const sum = scores.reduce((a, s) => a + s.split_score, 0);
    const avg = sum / scores.length;
    const t7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = scores.filter((s) => new Date(s.created_at).getTime() >= t7)
      .length;
    const dialPct = Math.min(100, Math.max(0, (avg / 5) * 100));
    const totalSpend = scores.reduce((acc, s) => {
      const p = s.pint_price;
      if (p == null || !Number.isFinite(Number(p))) return acc;
      return acc + Number(p);
    }, 0);
    return {
      count: scores.length,
      best,
      avg,
      last7,
      dialPct,
      totalSpend,
    };
  }, [scores]);

  const acceptedFriends = useMemo(
    () => friends.filter((f) => user != null && f.user_id === user.id),
    [friends, user],
  );

  const comparisonWindowStart = useMemo(
    () => progressRangeStart(progressRange),
    [progressRange],
  );

  const filteredComparisonScores = useMemo(() => {
    if (comparisonWindowStart == null) return comparisonScores;
    return comparisonScores.filter(
      (row) => new Date(row.created_at).getTime() >= comparisonWindowStart,
    );
  }, [comparisonScores, comparisonWindowStart]);

  const friendProgressLeaderboard = useMemo(
    () =>
      buildFriendLeaderboard(
        filteredComparisonScores,
        comparisonLabels,
        user?.email ? normalizeEmail(user.email) : null,
      ),
    [comparisonLabels, filteredComparisonScores, user],
  );

  const allTimeFriendLeaderboard = useMemo(
    () =>
      buildFriendLeaderboard(
        comparisonScores,
        comparisonLabels,
        user?.email ? normalizeEmail(user.email) : null,
      ),
    [comparisonLabels, comparisonScores, user],
  );

  const allTimeFriendStatsByEmail = useMemo(
    () =>
      allTimeFriendLeaderboard.reduce<Record<string, FriendLeaderboardEntry>>((acc, entry) => {
        acc[entry.email] = entry;
        return acc;
      }, {}),
    [allTimeFriendLeaderboard],
  );

  const loadSocial = useCallback(async (u: User): Promise<UserFriendRow[]> => {
    const supabase = await getSupabaseBrowserClient();
    const uid = u.id;
    const emailNorm = u.email ? normalizeEmail(u.email) : "";

    const [{ data: out }, { data: inc }, { data: fr }] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("id, from_user_id, to_email, from_email, status, created_at")
        .eq("from_user_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("friend_requests")
        .select("id, from_user_id, to_email, from_email, status, created_at")
        .eq("to_email", emailNorm)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_friends")
        .select("user_id, friend_user_id, peer_email, created_at")
        .or(`user_id.eq.${uid},friend_user_id.eq.${uid}`),
    ]);

    setOutgoingRequests((out ?? []) as FriendRequestRow[]);
    const incRows = (inc ?? []) as FriendRequestRow[];
    setIncomingRequests(incRows.filter((r) => r.from_user_id !== uid));
    const friendRows = (fr ?? []) as UserFriendRow[];
    setFriends(friendRows);
    return friendRows;
  }, []);

  const loadFriendComparison = useCallback(async (u: User, friendRows: UserFriendRow[]) => {
    const supabase = await getSupabaseBrowserClient();
    if (!u.email) {
      setComparisonScores([]);
      setComparisonLabels({});
      return;
    }

    const ownFriendRows = friendRows.filter((row) => row.user_id === u.id);
    const comparisonEmails = [
      normalizeEmail(u.email),
      ...ownFriendRows
        .map((row) => row.peer_email?.trim())
        .filter((value): value is string => Boolean(value))
        .map(normalizeEmail),
    ];
    const uniqueEmails = [...new Set(comparisonEmails)].filter(Boolean);
    const friendUserIds = ownFriendRows.map((row) => row.friend_user_id);
    const profileIds = [...new Set([u.id, ...friendUserIds])];

    if (uniqueEmails.length === 0) {
      setComparisonScores([]);
      setComparisonLabels({});
      return;
    }

    const { data: scoreRows } = await supabase
      .from("scores")
      .select("email, username, split_score, created_at")
      .in("email", uniqueEmails)
      .order("created_at", { ascending: false })
      .limit(500);

    const profileRes = await supabase
      .from("public_profiles")
      .select("user_id, display_name, nickname")
      .in("user_id", profileIds);

    let profileRows = (profileRes.data ?? []) as PublicProfileRow[];
    if (profileRes.error) {
      const fallback = await supabase
        .from("public_profiles")
        .select("user_id, display_name")
        .in("user_id", profileIds);
      profileRows = (fallback.data ?? []) as PublicProfileRow[];
    }

    const profileByUserId = new Map(profileRows.map((row) => [row.user_id, row]));
    const labels: Record<string, string> = {};
    labels[normalizeEmail(u.email)] =
      profileByUserId.get(u.id)?.nickname?.trim() ||
      profileByUserId.get(u.id)?.display_name?.trim() ||
      fullName.trim() ||
      emailDisplayName(u.email);

    for (const row of ownFriendRows) {
      const peerEmail = row.peer_email?.trim();
      if (!peerEmail) continue;
      const profile = profileByUserId.get(row.friend_user_id);
      labels[normalizeEmail(peerEmail)] =
        profile?.nickname?.trim() ||
        profile?.display_name?.trim() ||
        emailDisplayName(peerEmail);
    }

    setComparisonLabels(labels);
    setComparisonScores((scoreRows ?? []) as ComparisonScoreRow[]);
  }, [fullName]);

  const loadProfileData = useCallback(
    async (
      u: User,
      overrides?: Partial<{
        includeScores: boolean;
        includeFavorites: boolean;
        includeSocial: boolean;
      }>,
    ) => {
      const supabase = await getSupabaseBrowserClient();
      const options = { ...activeLoadOptions, ...overrides };
      const email = u.email;
      if (email && options.includeScores) {
        const emailTrim = email.trim();
        const pattern = escapeIlikePattern(emailTrim);
        const { data: scoreRows, error: scoresQerr } = await supabase
          .from("scores")
          .select("id, slug, split_score, created_at, bar_name, pint_price")
          .ilike("email", pattern)
          .order("created_at", { ascending: false })
          .limit(40);
        if (scoresQerr || !scoreRows?.length) {
          const { data: fallbackRows } = await supabase
            .from("scores")
            .select("id, slug, split_score, created_at, bar_name, pint_price")
            .eq("email", emailTrim)
            .order("created_at", { ascending: false })
            .limit(40);
          setScores((fallbackRows ?? scoreRows ?? []) as ScoreSummary[]);
        } else {
          setScores(scoreRows as ScoreSummary[]);
        }
      } else {
        setScores([]);
      }

      const { data: achRows, error: achErr } = await supabase
        .from("user_achievements")
        .select("code")
        .eq("user_id", u.id);
      if (!achErr) {
        setPersistedAchievementCodes(
          (achRows ?? [])
            .map((r) => String((r as { code?: string }).code ?? "").trim())
            .filter(Boolean),
        );
      } else {
        setPersistedAchievementCodes([]);
      }

      const { data: streakRow, error: streakErr } = await supabase
        .from("user_streak_snapshots")
        .select("daily_streak, weekly_streak, weekend_streak, last_computed_at")
        .eq("user_id", u.id)
        .maybeSingle();
      if (!streakErr && streakRow) {
        const r = streakRow as {
          daily_streak?: number | null;
          weekly_streak?: number | null;
          weekend_streak?: number | null;
          last_computed_at?: string | null;
        };
        setStreakSnapshot({
          daily: Number(r.daily_streak ?? 0),
          weekly: Number(r.weekly_streak ?? 0),
          weekend: Number(r.weekend_streak ?? 0),
          updatedAt: r.last_computed_at ?? null,
        });
      } else {
        setStreakSnapshot(null);
      }

      if (options.includeFavorites) {
        const { data: favRows, error: favErr } = await supabase
          .from("user_favorite_bars")
          .select("id, bar_name, bar_address, created_at")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false });

        const nextFavorites = favErr ? [] : ((favRows ?? []) as FavoriteRow[]);
        setFavorites(nextFavorites);
        if (nextFavorites.length > 0) {
          const favoriteNames = [...new Set(nextFavorites.map((f) => f.bar_name))];
          const { data: ratingRows } = await supabase
            .from("scores")
            .select("bar_name, bar_address, split_score")
            .in("bar_name", favoriteNames);

          const stats = (ratingRows ?? []).reduce<Record<string, FavoriteBarStats>>(
            (acc, row) => {
              const name = String(row.bar_name ?? "").trim();
              if (!name) return acc;
              const keys = [barKey(name, row.bar_address as string | null), barKey(name)];
              for (const key of keys) {
                const current = acc[key] ?? { avg: 0, count: 0 };
                const nextCount = current.count + 1;
                acc[key] = {
                  avg:
                    (current.avg * current.count + Number(row.split_score ?? 0)) /
                    nextCount,
                  count: nextCount,
                };
              }
              return acc;
            },
            {},
          );
          setFavoriteStats(stats);
        } else {
          setFavoriteStats({});
        }
      }

      const fromGoogle =
        (u.user_metadata?.full_name as string | undefined)?.trim() ||
        (u.user_metadata?.name as string | undefined)?.trim() ||
        u.email?.split("@")[0] ||
        t("pages.profile.defaultPlayerFallback");

      const profRes = await supabase
        .from("public_profiles")
        .select("display_name, nickname, country_code")
        .eq("user_id", u.id)
        .maybeSingle();

      let prof = (profRes.data ?? null) as PublicProfileRow | null;
      let profErr = profRes.error;

      if (profErr) {
        const msg = `${profErr.message ?? ""} ${profErr.code ?? ""}`.toLowerCase();
        const likelyMissingCol =
          msg.includes("nickname") ||
          msg.includes("country_code") ||
          msg.includes("column") ||
          profErr.code === "42703";
        if (likelyMissingCol) {
          const r2 = await supabase
            .from("public_profiles")
            .select("display_name, nickname")
            .eq("user_id", u.id)
            .maybeSingle();
          prof = (r2.data ?? null) as PublicProfileRow | null;
          profErr = r2.error;
          if (!profErr && prof) {
            setCountryCode("");
          }
        }
      }

      if (profErr) {
        setFullName(fromGoogle);
        setNickname("");
        setCountryCode("");
        if (options.includeSocial) {
          const socialRows = await loadSocial(u);
          await loadFriendComparison(u, socialRows);
        }
        return;
      }

      if (!prof) {
        await supabase.from("public_profiles").insert({
          user_id: u.id,
          display_name: fromGoogle,
          updated_at: new Date().toISOString(),
        });
        setFullName(fromGoogle);
        setNickname("");
        setCountryCode("");
      } else {
        setFullName(prof.display_name?.trim() || fromGoogle);
        const rawNick = "nickname" in prof ? prof.nickname : null;
        setNickname(
          rawNick != null && String(rawNick).trim() !== ""
            ? String(rawNick).trim()
            : "",
        );
        const cc =
          "country_code" in prof && prof.country_code != null
            ? String(prof.country_code).trim().toUpperCase()
            : "";
        setCountryCode(/^[A-Z]{2}$/.test(cc) ? cc : "");
      }

      if (options.includeSocial) {
        const socialRows = await loadSocial(u);
        await loadFriendComparison(u, socialRows);
      }
    },
    [activeLoadOptions, loadFriendComparison, loadSocial, t],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(data.user ?? null);
      setLoading(false);
    }

    void init();

    void getSupabaseBrowserClient().then((supabase) => {
      if (cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        const next = session?.user ?? null;
        setUser(next);
        if (!next) {
          setScores([]);
          setFavorites([]);
          setFavoriteStats({});
          setOutgoingRequests([]);
          setIncomingRequests([]);
          setFriends([]);
          setComparisonScores([]);
          setComparisonLabels({});
          setPersistedAchievementCodes([]);
          setStreakSnapshot(null);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loadProfileData]);

  useEffect(() => {
    if (!user) return;
    void loadProfileData(user);
  }, [loadProfileData, user]);

  useEffect(() => {
    clearPostOAuthReturnIfMatchesCurrentPath(
      location.pathname,
      location.search,
    );
  }, [location.pathname, location.search]);

  const signInGoogle = async () => {
    hideToast();
    rememberPathBeforeGoogleOAuth();
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: googleOAuthRedirectToSiteRoot() },
    });
    if (error) {
      const detail =
        error.message?.trim() || t("pages.profile.msgSignInFallback");
      showToast(t("pages.profile.msgSignInFailed", { detail }));
    }
  };

  const signOut = async () => {
    const supabase = await getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setScores([]);
    setFavorites([]);
    setOutgoingRequests([]);
    setIncomingRequests([]);
    setFriends([]);
    setComparisonScores([]);
    setComparisonLabels({});
    setPersistedAchievementCodes([]);
    setStreakSnapshot(null);
    setFullName("");
    setNickname("");
    setCountryCode("");
  };

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    hideToast();
    const nameTrim = fullName.trim();
    if (!nameTrim) {
      showToast(t("pages.profile.msgEnterFullName"));
      return;
    }
    const nickTrim = nickname.trim();
    if (nickTrim && !isValidNickname(nickTrim)) {
      showToast(t("pages.profile.msgNicknameRules"));
      return;
    }
    const ccRaw = countryCode.trim().toUpperCase();
    if (ccRaw && !/^[A-Z]{2}$/.test(ccRaw)) {
      showToast(t("pages.profile.msgCountryInvalid"));
      return;
    }
    setProfileSaving(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      if (nickTrim) {
        const { data: taken } = await supabase
          .from("public_profiles")
          .select("user_id")
          .eq("nickname", nickTrim)
          .neq("user_id", user.id)
          .maybeSingle();
        if (taken) {
          showToast(t("pages.profile.msgNicknameTaken"));
          return;
        }
      }

      const { error: perr } = await supabase.from("public_profiles").upsert(
        {
          user_id: user.id,
          display_name: nameTrim,
          nickname: nickTrim || null,
          country_code: ccRaw || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (perr) {
        showToast(
          perr.code === "23505"
            ? t("pages.profile.msgNicknameTakenShort")
            : perr.message,
        );
        return;
      }

      const leaderboardName = nickTrim || nameTrim;
      const emailTrim = user.email.trim();
      const ilikePattern = escapeIlikePattern(emailTrim);

      const { error: rpcErr } = await supabase.rpc("sync_scores_username_for_jwt", {
        p_username: leaderboardName,
      });

      if (rpcErr) {
        const { error: serr } = await supabase
          .from("scores")
          .update({ username: leaderboardName })
          .ilike("email", ilikePattern);
        if (serr) {
          showToast(serr.message);
          return;
        }
      }

      setFullName(nameTrim);
      setNickname(nickTrim);
      setCountryCode(ccRaw);
      await loadProfileData(user, { includeScores: true, includeSocial: true });
      showToast(t("pages.profile.msgProfileSaved"));
    } finally {
      setProfileSaving(false);
    }
  }

  const addFavorite = async (e: FormEvent) => {
    e.preventDefault();
    hideToast();
    if (!user) {
      showToast(t("pages.profile.msgSignInForFavorites"));
      return;
    }
    const name = favName.trim();
    if (!name) {
      showToast(t("pages.profile.msgEnterBarName"));
      return;
    }
    setBusy(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const { error } = await supabase.from("user_favorite_bars").insert({
        user_id: user.id,
        bar_name: name,
        bar_address: favAddress.trim() || null,
      });
      if (error) {
        showToast(error.message);
        return;
      }
      setFavName("");
      setFavAddress("");
      await loadProfileData(user, { includeFavorites: true });
      showToast(t("pages.profile.msgFavoriteSaved"));
    } finally {
      setBusy(false);
    }
  };

  const removeFavorite = async (id: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const { error } = await supabase
        .from("user_favorite_bars")
        .delete()
        .eq("id", id);
      if (error) {
        showToast(error.message);
        return;
      }
      await loadProfileData(user, { includeFavorites: true });
      showToast(t("pages.profile.msgFavoriteRemoved"));
    } finally {
      setBusy(false);
    }
  };

  async function sendFriendRequest() {
    if (!user?.email) return;
    hideToast();
    const to = normalizeEmail(friendEmail);
    if (!to || !to.includes("@")) {
      showToast(t("pages.profile.msgValidEmail"));
      return;
    }
    if (to === normalizeEmail(user.email)) {
      showToast(t("pages.profile.msgCannotAddSelf"));
      return;
    }
    if (
      acceptedFriends.some(
        (friend) => friend.peer_email && normalizeEmail(friend.peer_email) === to,
      )
    ) {
      showToast(t("pages.profile.msgAlreadyFriends"));
      return;
    }
    setBusy(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const alreadyPending = outgoingRequests.some(
        (request) => normalizeEmail(String(request.to_email)) === to,
      );

      if (!alreadyPending) {
        const { error } = await supabase.from("friend_requests").insert({
          from_user_id: user.id,
          to_email: to,
          from_email: user.email ?? null,
          status: "pending",
        });
        if (error) {
          showToast(error.message);
          return;
        }
      }

      const inviterName =
        fullName.trim() ||
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        (user.user_metadata?.name as string | undefined)?.trim() ||
        null;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        await fetch("/api/push-notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            type: "friend_request_received",
            toEmail: to,
            actorName: inviterName,
            path: "/profile/friends",
          }),
        }).catch(() => null);
      }

      const emailResponse = await fetch("/api/friend-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviterEmail: user.email,
          inviterName,
          toEmail: to,
        }),
      });

      if (!emailResponse.ok) {
        const emailResult = (await emailResponse.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        showToast(
          emailResult?.error
            ? alreadyPending
              ? t("pages.profile.msgInvitePendingEmailFail", {
                  error: emailResult.error,
                })
              : t("pages.profile.msgInviteSavedEmailFail", {
                  error: emailResult.error,
                })
            : alreadyPending
              ? t("pages.profile.msgInvitePendingNoEmail")
              : t("pages.profile.msgInviteSavedNoEmail"),
        );
      } else {
        showToast(
          alreadyPending
            ? t("pages.profile.msgFriendPendingResent")
            : t("pages.profile.msgFriendRequestSent"),
        );
      }

      setFriendEmail("");
      const socialRows = await loadSocial(user);
      await loadFriendComparison(user, socialRows);
    } finally {
      setBusy(false);
    }
  }

  async function respondRequest(
    row: FriendRequestRow,
    status: "accepted" | "declined",
  ) {
    if (!user) return;
    setBusy(true);
    hideToast();
    try {
      const supabase = await getSupabaseBrowserClient();
      const { error: uerr } = await supabase
        .from("friend_requests")
        .update({ status })
        .eq("id", row.id);
      if (uerr) {
        showToast(uerr.message);
        return;
      }
      if (status === "accepted") {
        const accepterEmail = user.email ?? null;
        const requesterEmail = row.from_email ?? null;
        const pair = [
          {
            user_id: row.from_user_id,
            friend_user_id: user.id,
            peer_email: accepterEmail,
          },
          {
            user_id: user.id,
            friend_user_id: row.from_user_id,
            peer_email: requesterEmail,
          },
        ] as const;
        for (const rowFriend of pair) {
          const { error: insErr } = await supabase
            .from("user_friends")
            .upsert(rowFriend, {
              onConflict: "user_id,friend_user_id",
              ignoreDuplicates: true,
            });
          if (insErr) {
            showToast(insErr.message);
            return;
          }
        }
        showToast(t("pages.profile.msgFriendAccepted"));
      } else {
        showToast(t("pages.profile.msgFriendDeclined"));
      }
      await loadProfileData(user, { includeSocial: true });
    } finally {
      setBusy(false);
    }
  }

  async function cancelOutgoingFriendRequest(row: FriendRequestRow) {
    if (!user) return;
    setBusy(true);
    hideToast();
    try {
      const supabase = await getSupabaseBrowserClient();
      // Prefer UPDATE → withdrawn: original schema already grants UPDATE to senders via RLS.
      // DELETE often returns 0 rows without error if delete policy/migration never shipped.
      const { data: updated, error } = await supabase
        .from("friend_requests")
        .update({ status: "withdrawn" })
        .eq("id", row.id)
        .eq("from_user_id", user.id)
        .eq("status", "pending")
        .select("id");
      if (error) {
        showToast(error.message);
        await loadSocial(user);
        return;
      }
      if (!updated?.length) {
        showToast(t("pages.profile.msgInviteCancelFail"));
        await loadSocial(user);
        return;
      }
      const socialRows = await loadSocial(user);
      await loadFriendComparison(user, socialRows);
      showToast(t("pages.profile.msgInviteCancelled"));
    } finally {
      setBusy(false);
    }
  }

  async function removeFriendship(f: UserFriendRow) {
    if (!user) return;
    const other =
      f.user_id === user.id ? f.friend_user_id : f.user_id;
    setBusy(true);
    hideToast();
    try {
      const supabase = await getSupabaseBrowserClient();
      await supabase
        .from("user_friends")
        .delete()
        .eq("user_id", user.id)
        .eq("friend_user_id", other);
      await supabase
        .from("user_friends")
        .delete()
        .eq("user_id", other)
        .eq("friend_user_id", user.id);
      const socialRows = await loadSocial(user);
      await loadFriendComparison(user, socialRows);
      showToast(t("pages.profile.msgFriendRemoved"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-guinness-cream focus:border-guinness-gold focus:outline-none";

  const profileHeaderBackButtonClass =
    "inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-guinness-gold/35 bg-guinness-black/50 px-4 py-2.5 text-sm font-semibold text-guinness-gold transition-colors hover:border-guinness-gold/55 hover:bg-guinness-brown/40 sm:w-auto sm:px-6 sm:text-base";

  /** Mobile subsection: compact Back, top-right (not full-width). */
  const profileMobileBackTopClass =
    "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-guinness-gold/40 bg-guinness-black/60 px-3.5 py-2 text-sm font-semibold text-guinness-gold shadow-[0_0_0_1px_rgba(212,175,55,0.08)] transition-colors hover:border-guinness-gold/60 hover:bg-guinness-gold/10";

  const countrySelectClass =
    "w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/60 py-2 pl-3 text-guinness-cream focus:border-guinness-gold focus:outline-none " +
    NATIVE_SELECT_APPEARANCE_CLASS;

  const messageVariant = message ? feedbackVariantFromMessage(message) : "info";

  const showMobileProfileSubHeader =
    Boolean(user) && !showProfileHeaderPour;
  const hidePageHeaderOnMobile =
    showMobileProfileSubHeader ||
    isMobileProfileHubDashboard ||
    isMobileProfileGuestHero;

  if (isProfileFaqPath) {
    if (loading) {
      return (
        <main className="min-h-screen bg-guinness-black text-guinness-cream">
          <div className={pageShellClass}>
            <p className="type-meta text-guinness-tan/70">
              {t("pages.profile.loading")}
            </p>
          </div>
        </main>
      );
    }
    if (!user) {
      return (
        <main className="min-h-screen bg-guinness-black text-guinness-cream">
          <Outlet
            context={
              { faqHeaderMode: "full" } satisfies ProfileLayoutOutletContext
            }
          />
        </main>
      );
    }
  }

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        {showMobileProfileSubHeader ? (
          <header
            className="mb-6 border-b border-guinness-gold/10 pb-4 md:hidden"
            aria-label={t("pages.profile.ariaProfileSection")}
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 justify-start">
                <AppLink
                  to="/profile"
                  viewTransition
                  className={profileMobileBackTopClass}
                >
                  {t("pages.profile.back")}
                </AppLink>
              </div>
              <h1 className="type-display min-w-0 max-w-[70vw] truncate text-center text-2xl leading-tight text-guinness-gold">
                {mobileSubsectionTitle}
              </h1>
              <div className="min-w-0" aria-hidden />
            </div>
          </header>
        ) : null}

        <PageHeader
          className={hidePageHeaderOnMobile ? "hidden md:flex" : ""}
          title={profileHeaderTitle}
          description={profileHeaderDescription}
        >
          {showProfileHeaderPour ? (
            <AppLink to="/" viewTransition className={pageHeaderActionButtonClass}>
              {t("common.pour")}
            </AppLink>
          ) : (
            <AppLink
              to="/profile"
              viewTransition
              className={profileHeaderBackButtonClass}
            >
              {t("common.back")}
            </AppLink>
          )}
        </PageHeader>

        {loading ? (
          <p className="type-meta text-guinness-tan/70">
            {t("pages.profile.loading")}
          </p>
        ) : !user ? (
          <>
            {isMobileProfileGuestHero ? (
              <ProfileMobileGuestHub
                onSignInGoogle={() => void signInGoogle()}
              />
            ) : null}
            <div
              className={`rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-6 ${isMobileProfileGuestHero ? "hidden md:block" : ""}`}
            >
              <p className="type-meta mb-4 text-guinness-tan/85">
                {t("pages.profile.signInBlurb")}
              </p>
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className="w-full rounded-lg border border-guinness-gold/45 bg-guinness-gold/15 py-3 font-semibold text-guinness-cream transition-colors hover:border-guinness-gold/70 hover:bg-guinness-gold/25"
              >
                {t("pages.profile.signInGoogle")}
              </button>
              <p className="type-meta mt-5 text-center text-guinness-tan/75">
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
          </>
        ) : (
          <div className="space-y-8">
            <ProfilePageProvider
              value={{
                user,
                scores,
                favorites,
                favoriteStats,
                progressStats,
                progressRange,
                setProgressRange,
                friendProgressLeaderboard,
                friendEmail,
                setFriendEmail,
                sendFriendRequest,
                acceptedFriends,
                incomingRequests,
                outgoingRequests,
                busy,
                favName,
                setFavName,
                favAddress,
                setFavAddress,
                addFavorite,
                removeFavorite,
                respondRequest,
                cancelOutgoingFriendRequest,
                removeFriendship,
                allTimeFriendStatsByEmail,
                persistedAchievementCodes,
                streakSnapshot,
                inputClass,
              }}
            >
              {user && isProfileHubPath ? (
                isMobileProfileHubDashboard ? (
                  <ProfileMobileSignedInHub
                    user={user}
                    fullName={fullName}
                    nickname={nickname}
                    countryCode={countryCode}
                    scores={scores}
                    favorites={favorites}
                    acceptedFriends={acceptedFriends}
                    comparisonScores={comparisonScores}
                    comparisonLabels={comparisonLabels}
                    incomingFriendRequestCount={incomingRequests.length}
                    outgoingFriendPendingCount={outgoingRequests.length}
                  />
                ) : (
                  <nav
                    className="md:hidden"
                    aria-label={t("pages.profile.ariaProfileSections")}
                  >
                    <ul className="space-y-2">
                      {profileNavItemsWithFaq.map(({ to, label }) => (
                        <li key={to}>
                          <AppLink
                            to={to}
                            prefetch="intent"
                            viewTransition
                            className="flex min-h-[3.25rem] items-center justify-between gap-3 rounded-xl border border-guinness-gold/20 bg-guinness-brown/35 px-4 py-3 text-guinness-cream transition-colors active:bg-guinness-brown/50 hover:border-guinness-gold/40"
                          >
                            <span className="text-[15px] font-semibold">{label}</span>
                            <span className="text-guinness-gold" aria-hidden>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-5 w-5 opacity-80"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          </AppLink>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )
              ) : null}

              <SegmentedTabsNav
                items={profileNavLinkItems}
                activeValue={profileActiveSection}
                layoutClassName="hidden md:grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-7"
                aria-label={t("pages.profile.ariaProfileSections")}
              />

              {showAccountFormSection ? (
                <section className="mt-6 rounded-xl border border-guinness-gold/20 bg-guinness-brown/40 p-5 sm:p-6">
                  <div className="flex flex-col gap-1 border-b border-guinness-gold/10 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="type-label text-guinness-gold">
                        {t("pages.profile.signedIn")}
                      </p>
                      <p className="mt-1 truncate text-sm text-guinness-tan/80">
                        {user.email}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-guinness-cream">
                        {countryCode ? (
                          <span className="mr-2" title={countryCode} aria-hidden>
                            {flagEmojiFromIso2(countryCode)}
                          </span>
                        ) : null}
                        {fullName || t("pages.profile.namePlaceholderDash")}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(ev) => void saveProfile(ev)}
                    className="mt-4 space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="profile-full-name"
                        className="type-label mb-1.5 block text-guinness-tan/85"
                      >
                        {t("pages.profile.fullName")}
                      </label>
                      <input
                        id="profile-full-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        className={inputClass}
                        placeholder={t("pages.profile.fullNamePlaceholder")}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="profile-nickname"
                        className="type-label mb-1.5 block text-guinness-tan/85"
                      >
                        {t("pages.profile.nickname")}
                      </label>
                      <input
                        id="profile-nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className={inputClass}
                        placeholder={t("pages.profile.nicknamePlaceholder")}
                        maxLength={30}
                        autoComplete="nickname"
                      />
                      <p className="type-meta mt-1.5 text-guinness-tan/60">
                        {t("pages.profile.nicknameHint")}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="profile-country"
                        className="type-label mb-1.5 block text-guinness-tan/85"
                      >
                        {t("pages.profile.country")}
                      </label>
                      <select
                        id="profile-country"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className={countrySelectClass}
                      >
                        <option value="">{t("pages.profile.countryNotSet")}</option>
                        {countryOptions.map((c) => (
                          <option key={c.code} value={c.code}>
                            {flagEmojiFromIso2(c.code)} {c.name}
                          </option>
                        ))}
                      </select>
                      <p className="type-meta mt-1.5 text-guinness-tan/60">
                        {t("pages.profile.countryHint")}{" "}
                        <strong className="font-medium text-guinness-tan/75">
                          {t("pages.profile.countryHintBold")}
                        </strong>{" "}
                        {t("pages.profile.countryHintRest")}
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="w-full rounded-lg bg-guinness-gold py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 sm:w-auto sm:px-8"
                    >
                      {profileSaving
                        ? t("pages.profile.savingProfile")
                        : t("pages.profile.saveProfile")}
                    </button>
                  </form>

                  <div className="mt-5 border-t border-guinness-gold/10 pt-4">
                    <PushNotificationsManager />
                    <button
                      type="button"
                      onClick={() => setSignOutConfirmOpen(true)}
                      className="w-full rounded-lg border border-guinness-gold/35 bg-guinness-black/50 py-3 text-sm font-semibold text-guinness-tan transition-colors hover:border-guinness-gold/50 hover:bg-guinness-brown/55 hover:text-guinness-cream"
                    >
                      {t("pages.profile.signOut")}
                    </button>
                  </div>
                </section>
              ) : null}

              <div className={isProfileHubPath ? "md:mt-6" : "mt-6"}>
                <Outlet
                  context={
                    { faqHeaderMode: "compact" } satisfies ProfileLayoutOutletContext
                  }
                />
              </div>
            </ProfilePageProvider>
          </div>
        )}

        <BrandedToast
          open={Boolean(message)}
          message={message ?? ""}
          variant={messageVariant}
          title={
            toastTitleOverride ??
            (messageVariant === "danger"
              ? t("toasts.toastDangerTitle")
              : messageVariant === "warning"
                ? t("toasts.toastWarningTitle")
                : messageVariant === "info"
                  ? t("toasts.toastInfoTitle")
                  : undefined)
          }
          onClose={hideToast}
          autoCloseMs={toastAutoCloseForVariant(messageVariant)}
        />

        <BrandedNotice
          open={signOutConfirmOpen}
          onOpenChange={setSignOutConfirmOpen}
          title={t("pages.profile.signOutConfirmTitle")}
          description={t("pages.profile.signOutConfirmDescription")}
          variant="warning"
          secondaryLabel={t("pages.profile.staySignedIn")}
          primaryLabel={t("pages.profile.signOut")}
          onPrimary={async () => {
            setSignOutConfirmOpen(false);
            const preferredName =
              nickname.trim() ||
              fullName.trim() ||
              (user?.email ? emailDisplayName(user.email) : "");
            await signOut();
            showToast(
              signOutToastFromT(t, preferredName || "there"),
              t("toasts.toastSignedOutTitle"),
            );
          }}
        />

        {showMobileProfileSubHeader ? (
          <>
            <div className="mt-10 flex justify-center pb-6 md:hidden">
              <AppLink
                to="/profile"
                viewTransition
                className={homePourButtonClass}
              >
                {t("pages.profile.back")}
              </AppLink>
            </div>
            {!hideEndPageNewPourFooter ? (
              <div className="hidden md:block">
                <EndPageNewPourFooter />
              </div>
            ) : null}
          </>
        ) : !hideEndPageNewPourFooter ? (
          <EndPageNewPourFooter />
        ) : null}
      </div>
    </main>
  );
}
