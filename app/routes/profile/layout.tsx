import { Link, NavLink, Outlet, useLocation } from "react-router";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  profilePageDescription,
} from "~/components/PageHeader";
import { BrandedNotice } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import {
  feedbackVariantFromMessage,
  toastAutoCloseForVariant,
} from "~/components/branded/feedback-variant";
import { supabase } from "~/utils/supabase";
import {
  clearPostOAuthReturnIfMatchesCurrentPath,
  googleOAuthRedirectToSiteRoot,
  rememberPathBeforeGoogleOAuth,
} from "~/utils/post-oauth-return";
import { ProfilePageProvider } from "./profile-context";
import {
  barKey,
  buildFriendLeaderboard,
  escapeIlikePattern,
  emailDisplayName,
  normalizeEmail,
  segmentedTabGroupChromeClass,
  segmentedTabTriggerClass,
  progressRangeOptions,
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
  flagEmojiFromIso2,
  getCountryOptions,
} from "~/utils/countryDisplay";

const profileNavItems = [
  { to: "/profile/progress", label: "Progress" },
  { to: "/profile/expenses", label: "Expenses" },
  { to: "/profile/scores", label: "Scores" },
  { to: "/profile/favorites", label: "Favorite bars" },
  { to: "/profile/friends", label: "Friends" },
] as const;

export default function ProfileLayout() {
  const location = useLocation();
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
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
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
  const [progressRange, setProgressRange] = useState<ProgressRange>("30d");
  const [comparisonScores, setComparisonScores] = useState<ComparisonScoreRow[]>([]);
  const [comparisonLabels, setComparisonLabels] = useState<Record<string, string>>({});

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
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_friends")
        .select("user_id, friend_user_id, peer_email, created_at")
        .or(`user_id.eq.${uid},friend_user_id.eq.${uid}`),
    ]);

    setOutgoingRequests((out ?? []) as FriendRequestRow[]);
    const incRows = (inc ?? []) as FriendRequestRow[];
    setIncomingRequests(
      incRows.filter(
        (r) => normalizeEmail(String(r.to_email)) === emailNorm && r.from_user_id !== uid,
      ),
    );
    const friendRows = (fr ?? []) as UserFriendRow[];
    setFriends(friendRows);
    return friendRows;
  }, []);

  const loadFriendComparison = useCallback(async (u: User, friendRows: UserFriendRow[]) => {
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
    async (u: User) => {
      const email = u.email;
      if (email) {
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

      const { data: favRows, error: favErr } = await supabase
        .from("user_favorite_bars")
        .select("id, bar_name, bar_address, created_at")
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

      const fromGoogle =
        (u.user_metadata?.full_name as string | undefined)?.trim() ||
        (u.user_metadata?.name as string | undefined)?.trim() ||
        u.email?.split("@")[0] ||
        "Player";

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
        const socialRows = await loadSocial(u);
        await loadFriendComparison(u, socialRows);
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

      const socialRows = await loadSocial(u);
      await loadFriendComparison(u, socialRows);
    },
    [loadFriendComparison, loadSocial],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(data.user ?? null);
      if (data.user) await loadProfileData(data.user);
      setLoading(false);
    }

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (next) void loadProfileData(next);
      else {
        setScores([]);
        setFavorites([]);
        setOutgoingRequests([]);
        setIncomingRequests([]);
        setFriends([]);
        setComparisonScores([]);
        setComparisonLabels({});
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileData]);

  useEffect(() => {
    clearPostOAuthReturnIfMatchesCurrentPath(
      location.pathname,
      location.search,
    );
  }, [location.pathname, location.search]);

  const signInGoogle = async () => {
    setMessage(null);
    rememberPathBeforeGoogleOAuth();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: googleOAuthRedirectToSiteRoot() },
    });
    if (error) {
      const detail =
        error.message?.trim() ||
        "We couldn’t start Google sign-in. Try again in a moment.";
      setMessage(`Couldn’t start Google sign-in. ${detail}`);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setScores([]);
    setFavorites([]);
    setOutgoingRequests([]);
    setIncomingRequests([]);
    setFriends([]);
    setComparisonScores([]);
    setComparisonLabels({});
    setFullName("");
    setNickname("");
    setCountryCode("");
  };

  const nicknamePattern = /^[a-zA-Z0-9 _-]{2,30}$/;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setMessage(null);
    const nameTrim = fullName.trim();
    if (!nameTrim) {
      setMessage("Enter your full name.");
      return;
    }
    const nickTrim = nickname.trim();
    if (nickTrim && !nicknamePattern.test(nickTrim)) {
      setMessage(
        "Nickname: 2–30 characters, letters, numbers, spaces, hyphen or underscore.",
      );
      return;
    }
    const ccRaw = countryCode.trim().toUpperCase();
    if (ccRaw && !/^[A-Z]{2}$/.test(ccRaw)) {
      setMessage("Choose a country from the list, or leave it unset.");
      return;
    }
    setProfileSaving(true);
    try {
      if (nickTrim) {
        const { data: taken } = await supabase
          .from("public_profiles")
          .select("user_id")
          .eq("nickname", nickTrim)
          .neq("user_id", user.id)
          .maybeSingle();
        if (taken) {
          setMessage("That nickname is already taken. Try another.");
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
        setMessage(
          perr.code === "23505"
            ? "That nickname is already taken."
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
          setMessage(serr.message);
          return;
        }
      }

      setFullName(nameTrim);
      setNickname(nickTrim);
      setCountryCode(ccRaw);
      await loadProfileData(user);
      setMessage("Profile saved.");
    } finally {
      setProfileSaving(false);
    }
  }

  const addFavorite = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!user) {
      setMessage("Sign in to save favorites.");
      return;
    }
    const name = favName.trim();
    if (!name) {
      setMessage("Enter a bar name or pick from suggestions.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("user_favorite_bars").insert({
        user_id: user.id,
        bar_name: name,
        bar_address: favAddress.trim() || null,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setFavName("");
      setFavAddress("");
      await loadProfileData(user);
      setMessage("Favorite saved.");
    } finally {
      setBusy(false);
    }
  };

  const removeFavorite = async (id: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("user_favorite_bars")
        .delete()
        .eq("id", id);
      if (error) {
        setMessage(error.message);
        return;
      }
      await loadProfileData(user);
      setMessage("Favorite removed.");
    } finally {
      setBusy(false);
    }
  };

  async function sendFriendRequest() {
    if (!user?.email) return;
    setMessage(null);
    const to = normalizeEmail(friendEmail);
    if (!to || !to.includes("@")) {
      setMessage("Enter a valid email.");
      return;
    }
    if (to === normalizeEmail(user.email)) {
      setMessage("You cannot add yourself.");
      return;
    }
    if (
      acceptedFriends.some(
        (friend) => friend.peer_email && normalizeEmail(friend.peer_email) === to,
      )
    ) {
      setMessage("You are already friends with that email.");
      return;
    }
    setBusy(true);
    try {
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
          setMessage(error.message);
          return;
        }
      }

      const inviterName =
        fullName.trim() ||
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        (user.user_metadata?.name as string | undefined)?.trim() ||
        null;

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
        setMessage(
          emailResult?.error
            ? alreadyPending
              ? `Request already pending, but email invite failed: ${emailResult.error}`
              : `Request saved, but email invite failed: ${emailResult.error}`
            : alreadyPending
              ? "Request already pending, but email invite failed."
              : "Request saved, but email invite failed.",
        );
      } else {
        setMessage(
          alreadyPending
            ? "Friend request already pending. Invite email sent again."
            : "Friend request sent.",
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
    setMessage(null);
    try {
      const { error: uerr } = await supabase
        .from("friend_requests")
        .update({ status })
        .eq("id", row.id);
      if (uerr) {
        setMessage(uerr.message);
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
            setMessage(insErr.message);
            return;
          }
        }
        setMessage("Friend request accepted. You’re now friends.");
      } else {
        setMessage("Friend request declined.");
      }
      await loadProfileData(user);
    } finally {
      setBusy(false);
    }
  }

  async function cancelOutgoingFriendRequest(row: FriendRequestRow) {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
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
        setMessage(error.message);
        await loadSocial(user);
        return;
      }
      if (!updated?.length) {
        setMessage(
          "Couldn’t cancel that invite. Refresh the page, then try again after applying the latest database migration (withdrawn status for friend requests).",
        );
        await loadSocial(user);
        return;
      }
      const socialRows = await loadSocial(user);
      await loadFriendComparison(user, socialRows);
      setMessage("Invite cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFriendship(f: UserFriendRow) {
    if (!user) return;
    const other =
      f.user_id === user.id ? f.friend_user_id : f.user_id;
    setBusy(true);
    setMessage(null);
    try {
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
      setMessage("Friend removed.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-guinness-cream focus:border-guinness-gold focus:outline-none";

  const messageVariant = message ? feedbackVariantFromMessage(message) : "info";

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title="Profile" description={profilePageDescription}>
          <Link to="/" viewTransition className={pageHeaderActionButtonClass}>
            New pour
          </Link>
        </PageHeader>

        {loading ? (
          <p className="type-meta text-guinness-tan/70">Loading…</p>
        ) : !user ? (
          <div className="rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-6">
            <p className="type-meta mb-4 text-guinness-tan/85">
              Sign in with Google to link your email to scores you claim, add
              friends, and sync favorites.
            </p>
            <button
              type="button"
              onClick={() => void signInGoogle()}
              className="w-full rounded-lg border border-guinness-gold/45 bg-guinness-gold/15 py-3 font-semibold text-guinness-cream transition-colors hover:border-guinness-gold/70 hover:bg-guinness-gold/25"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/40 p-5 sm:p-6">
              <div className="flex flex-col gap-1 border-b border-guinness-gold/10 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="type-label text-guinness-gold">Signed in</p>
                  <p className="mt-1 truncate text-sm text-guinness-tan/80">
                    {user.email}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-guinness-cream">
                    {countryCode ? (
                      <span className="mr-2" title={countryCode} aria-hidden>
                        {flagEmojiFromIso2(countryCode)}
                      </span>
                    ) : null}
                    {fullName || "—"}
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
                    Full name
                  </label>
                  <input
                    id="profile-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-nickname"
                    className="type-label mb-1.5 block text-guinness-tan/85"
                  >
                    Nickname (leaderboard)
                  </label>
                  <input
                    id="profile-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={inputClass}
                    placeholder="Optional — shown instead of full name"
                    maxLength={30}
                    autoComplete="nickname"
                  />
                  <p className="type-meta mt-1.5 text-guinness-tan/60">
                    Leave blank to use your full name on feeds and boards. Must
                    be unique (letters, numbers, spaces, - or _). 2–30 characters.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="profile-country"
                    className="type-label mb-1.5 block text-guinness-tan/85"
                  >
                    Country
                  </label>
                  <select
                    id="profile-country"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not set</option>
                    {countryOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {flagEmojiFromIso2(c.code)} {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="type-meta mt-1.5 text-guinness-tan/60">
                    Shown as a flag next to your name.{" "}
                    <strong className="font-medium text-guinness-tan/75">
                      Local leaderboard
                    </strong>{" "}
                    lists top pours this week from everyone who chose this same
                    country on their profile.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full rounded-lg bg-guinness-gold py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {profileSaving ? "Saving…" : "Save profile"}
                </button>
              </form>

              <div className="mt-5 border-t border-guinness-gold/10 pt-4">
                <button
                  type="button"
                  onClick={() => setSignOutConfirmOpen(true)}
                  className="w-full rounded-lg border border-guinness-gold/35 bg-guinness-black/50 py-3 text-sm font-semibold text-guinness-tan transition-colors hover:border-guinness-gold/50 hover:bg-guinness-brown/55 hover:text-guinness-cream"
                >
                  Sign out
                </button>
              </div>
            </section>

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
                inputClass,
              }}
            >
              <nav
                className={`grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${segmentedTabGroupChromeClass}`}
                aria-label="Profile sections"
              >
                {profileNavItems.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    prefetch="intent"
                    viewTransition
                    className={({ isActive }) =>
                      segmentedTabTriggerClass(isActive, "gridCell")
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-6">
                <Outlet />
              </div>
            </ProfilePageProvider>
          </div>
        )}

        <BrandedToast
          open={Boolean(message)}
          message={message ?? ""}
          variant={messageVariant}
          title={
            messageVariant === "danger"
              ? "Couldn’t complete that"
              : messageVariant === "warning"
                ? "Heads up"
                : messageVariant === "info"
                  ? "Update"
                  : undefined
          }
          onClose={() => setMessage(null)}
          autoCloseMs={toastAutoCloseForVariant(messageVariant)}
        />

        <BrandedNotice
          open={signOutConfirmOpen}
          onOpenChange={setSignOutConfirmOpen}
          title="Sign out?"
          description="You’ll need to sign in again to manage your profile, friends, and favorites."
          variant="warning"
          secondaryLabel="Stay signed in"
          primaryLabel="Sign out"
          onPrimary={async () => {
            setSignOutConfirmOpen(false);
            await signOut();
            setMessage("Signed out successfully.");
          }}
        />

        <div className="mt-10 flex justify-center">
          <Link
            to="/"
            viewTransition
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-guinness-gold/25 px-5 py-2.5 text-sm font-medium text-guinness-gold hover:bg-guinness-brown/50"
          >
            Back to pour
          </Link>
        </div>
      </div>
    </main>
  );
}
