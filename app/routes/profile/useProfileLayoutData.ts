import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { signOutToastFromT } from "~/i18n/auth-copy";
import { useI18n } from "~/i18n/context";
import { analyticsEventNames } from "~/utils/analytics/events";
import { trackEvent } from "~/utils/analytics/client";
import {
  getAnalyticsConsent,
  type AnalyticsConsentStatus,
} from "~/utils/analytics/consent";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { isValidNickname } from "~/utils/profile-nickname";
import {
  clearPostOAuthReturnIfMatchesCurrentPath,
  googleOAuthRedirectToSiteRoot,
  rememberPathBeforeGoogleOAuth,
} from "~/utils/post-oauth-return";
import {
  barKey,
  buildFriendLeaderboard,
  emailDisplayName,
  escapeIlikePattern,
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
  achievementHubSummaryFromSnapshot,
} from "./profile-achievements";
import type { StreakSnapshot } from "./profile-context";

type LoadProfileOverrides = Partial<{
  includeScores: boolean;
  includeFavorites: boolean;
  includeSocial: boolean;
}>;

type ProfileToastApi = {
  hideToast: () => void;
  showToast: (message: string, title?: string) => void;
};

type UseProfileLayoutDataArgs = ProfileToastApi & {
  locationPathname: string;
  locationSearch: string;
  revalidate: () => void;
};

export function useProfileLayoutData({
  hideToast,
  showToast,
  locationPathname,
  locationSearch,
  revalidate,
}: UseProfileLayoutDataArgs) {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<ScoreSummary[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoriteStats, setFavoriteStats] = useState<Record<string, FavoriteBarStats>>(
    {},
  );
  const [favName, setFavName] = useState("");
  const [favAddress, setFavAddress] = useState("");
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
  const [countryCode, setCountryCode] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [hasPendingProfileSignIn, setHasPendingProfileSignIn] = useState(false);
  const [analyticsConsentStatus, setAnalyticsConsentStatus] =
    useState<AnalyticsConsentStatus>("unset");
  const [progressRange, setProgressRange] = useState<ProgressRange>("30d");
  const [comparisonScores, setComparisonScores] = useState<ComparisonScoreRow[]>([]);
  const [comparisonLabels, setComparisonLabels] = useState<Record<string, string>>({});
  const [persistedAchievementCodes, setPersistedAchievementCodes] = useState<string[]>(
    [],
  );
  const profileLoadGeneration = useRef(0);
  const [profileAchievementsReady, setProfileAchievementsReady] = useState(false);
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

  const accountAchievementSummary = useMemo(
    () =>
      achievementHubSummaryFromSnapshot(
        scores,
        persistedAchievementCodes,
        streakSnapshot,
      ),
    [scores, persistedAchievementCodes, streakSnapshot],
  );

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
      allTimeFriendLeaderboard.reduce<Record<string, FriendLeaderboardEntry>>(
        (acc, entry) => {
          acc[entry.email] = entry;
          return acc;
        },
        {},
      ),
    [allTimeFriendLeaderboard],
  );

  const activeLoadOptions = useMemo(
    () => ({
      includeScores: true,
      includeFavorites: true,
      includeSocial: true,
    }),
    [],
  );

  const resetProfileState = useCallback(() => {
    profileLoadGeneration.current += 1;
    setProfileAchievementsReady(false);
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
    setFullName("");
    setNickname("");
    setCountryCode("");
  }, []);

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

  const loadFriendComparison = useCallback(
    async (u: User, friendRows: UserFriendRow[]) => {
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
    },
    [fullName],
  );

  const loadProfileData = useCallback(
    async (u: User, overrides?: LoadProfileOverrides) => {
      const gen = ++profileLoadGeneration.current;
      setProfileAchievementsReady(false);
      try {
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
      } finally {
        if (profileLoadGeneration.current === gen) {
          setProfileAchievementsReady(true);
        }
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
          resetProfileState();
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [resetProfileState]);

  useEffect(() => {
    if (!user) return;
    if (hasPendingProfileSignIn) {
      trackEvent(analyticsEventNames.authGoogleSignInSucceeded, {
        source: "profile",
      });
      setHasPendingProfileSignIn(false);
    }
    void loadProfileData(user);
  }, [hasPendingProfileSignIn, loadProfileData, user]);

  useEffect(() => {
    clearPostOAuthReturnIfMatchesCurrentPath(locationPathname, locationSearch);
  }, [locationPathname, locationSearch]);

  useEffect(() => {
    setAnalyticsConsentStatus(getAnalyticsConsent());
  }, []);

  const signInGoogle = useCallback(async () => {
    trackEvent(analyticsEventNames.authGoogleSignInStarted, {
      source: "profile",
    });
    setHasPendingProfileSignIn(true);
    hideToast();
    rememberPathBeforeGoogleOAuth();
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: googleOAuthRedirectToSiteRoot() },
    });
    if (error) {
      trackEvent(analyticsEventNames.authGoogleSignInFailed, {
        source: "profile",
        reason: error.message,
      });
      setHasPendingProfileSignIn(false);
      const detail =
        error.message?.trim() || t("pages.profile.msgSignInFallback");
      showToast(t("pages.profile.msgSignInFailed", { detail }));
    }
  }, [hideToast, showToast, t]);

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseBrowserClient();
    await supabase.auth.signOut();
    resetProfileState();
  }, [resetProfileState]);

  const signOutWithToast = useCallback(async () => {
    const preferredName =
      nickname.trim() ||
      fullName.trim() ||
      (user?.email ? emailDisplayName(user.email) : "");
    await signOut();
    showToast(
      signOutToastFromT(t, preferredName || "there"),
      t("toasts.toastSignedOutTitle"),
    );
  }, [fullName, nickname, showToast, signOut, t, user]);

  const saveProfile = useCallback(
    async (e: FormEvent) => {
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
        trackEvent(analyticsEventNames.profileSaved, {
          hasNickname: Boolean(nickTrim),
          hasCountryCode: Boolean(ccRaw),
        });
        await loadProfileData(user, { includeScores: true, includeSocial: true });
        revalidate();
        showToast(t("pages.profile.msgProfileSaved"));
      } finally {
        setProfileSaving(false);
      }
    },
    [countryCode, fullName, hideToast, loadProfileData, nickname, revalidate, showToast, t, user],
  );

  const addFavorite = useCallback(
    async (e: FormEvent) => {
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
    },
    [favAddress, favName, hideToast, loadProfileData, showToast, t, user],
  );

  const removeFavorite = useCallback(
    async (id: string) => {
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
    },
    [loadProfileData, showToast, t, user],
  );

  const sendFriendRequest = useCallback(async () => {
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
  }, [
    acceptedFriends,
    friendEmail,
    fullName,
    hideToast,
    loadFriendComparison,
    loadSocial,
    outgoingRequests,
    showToast,
    t,
    user,
  ]);

  const respondRequest = useCallback(
    async (row: FriendRequestRow, status: "accepted" | "declined") => {
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
    },
    [hideToast, loadProfileData, showToast, t, user],
  );

  const cancelOutgoingFriendRequest = useCallback(
    async (row: FriendRequestRow) => {
      if (!user) return;
      setBusy(true);
      hideToast();
      try {
        const supabase = await getSupabaseBrowserClient();
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
    },
    [hideToast, loadFriendComparison, loadSocial, showToast, t, user],
  );

  const removeFriendship = useCallback(
    async (f: UserFriendRow) => {
      if (!user) return;
      const other = f.user_id === user.id ? f.friend_user_id : f.user_id;
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
    },
    [hideToast, loadFriendComparison, loadSocial, showToast, t, user],
  );

  const inputClass =
    "w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-guinness-cream focus:border-guinness-gold focus:outline-none";

  return {
    user,
    loading,
    scores,
    favorites,
    favoriteStats,
    favName,
    setFavName,
    favAddress,
    setFavAddress,
    busy,
    friendEmail,
    setFriendEmail,
    outgoingRequests,
    incomingRequests,
    fullName,
    setFullName,
    nickname,
    setNickname,
    countryCode,
    setCountryCode,
    profileSaving,
    analyticsConsentStatus,
    setAnalyticsConsentStatus,
    progressRange,
    setProgressRange,
    comparisonScores,
    comparisonLabels,
    persistedAchievementCodes,
    profileAchievementsReady,
    streakSnapshot,
    progressStats,
    accountAchievementSummary,
    acceptedFriends,
    friendProgressLeaderboard,
    allTimeFriendStatsByEmail,
    signInGoogle,
    signOutWithToast,
    saveProfile,
    addFavorite,
    removeFavorite,
    sendFriendRequest,
    respondRequest,
    cancelOutgoingFriendRequest,
    removeFriendship,
    inputClass,
  };
}
