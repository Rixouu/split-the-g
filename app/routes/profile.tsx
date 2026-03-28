import { Link, useLocation } from "react-router";
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
import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { supabase } from "~/utils/supabase";
import { scorePourPathFromFields } from "~/utils/scorePath";
import {
  clearPostOAuthReturnIfMatchesCurrentPath,
  googleOAuthRedirectToSiteRoot,
  rememberPathBeforeGoogleOAuth,
} from "~/utils/post-oauth-return";

type ProfileTab = "progress" | "scores" | "favorites" | "friends";
type ProgressRange = "7d" | "30d" | "90d" | "all";

type ScoreSummary = {
  id: string;
  slug?: string | null;
  split_score: number;
  created_at: string;
  bar_name: string | null;
};

type FavoriteRow = {
  id: string;
  bar_name: string;
  bar_address: string | null;
  created_at: string;
};

type FavoriteBarStats = {
  avg: number;
  count: number;
};

type FriendRequestRow = {
  id: string;
  from_user_id: string;
  to_email: string;
  from_email: string | null;
  status: string;
  created_at: string;
};

type UserFriendRow = {
  user_id: string;
  friend_user_id: string;
  peer_email: string | null;
  created_at: string;
};

type PublicProfileRow = {
  user_id: string;
  display_name: string | null;
  nickname?: string | null;
};

type ComparisonScoreRow = {
  email: string | null;
  username: string | null;
  split_score: number;
  created_at: string;
};

type FriendLeaderboardEntry = {
  email: string;
  label: string;
  pours: number;
  avg: number;
  best: number;
  latestAt: string;
  isCurrentUser: boolean;
};

const progressRangeOptions: { value: ProgressRange; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

function favoriteMapsUrl(f: FavoriteRow): string {
  const q = [f.bar_name, f.bar_address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function barKey(name: string, address?: string | null): string {
  return `${name.trim().toLowerCase()}::${(address ?? "").trim().toLowerCase()}`;
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

function emailDisplayName(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

/** PostgREST `ilike` treats `%` and `_` as wildcards; escape for literal email match. */
function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function progressRangeStart(range: ProgressRange): number | null {
  const now = Date.now();
  switch (range) {
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return now - 90 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function buildFriendLeaderboard(
  rows: ComparisonScoreRow[],
  labels: Record<string, string>,
  currentEmail: string | null,
): FriendLeaderboardEntry[] {
  const grouped = new Map<
    string,
    { total: number; count: number; best: number; latestAt: string; latestName: string | null }
  >();

  for (const row of rows) {
    const rawEmail = row.email?.trim();
    if (!rawEmail) continue;
    const email = normalizeEmail(rawEmail);
    const current = grouped.get(email) ?? {
      total: 0,
      count: 0,
      best: 0,
      latestAt: "",
      latestName: null,
    };

    current.total += Number(row.split_score ?? 0);
    current.count += 1;
    current.best = Math.max(current.best, Number(row.split_score ?? 0));
    if (!current.latestAt || new Date(row.created_at) > new Date(current.latestAt)) {
      current.latestAt = row.created_at;
      current.latestName = row.username?.trim() || null;
    }
    grouped.set(email, current);
  }

  return [...grouped.entries()]
    .map(([email, entry]) => ({
      email,
      label:
        labels[email] || entry.latestName || emailDisplayName(email),
      pours: entry.count,
      avg: entry.total / entry.count,
      best: entry.best,
      latestAt: entry.latestAt,
      isCurrentUser: currentEmail != null && normalizeEmail(currentEmail) === email,
    }))
    .sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.best !== a.best) return b.best - a.best;
      if (b.pours !== a.pours) return b.pours - a.pours;
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });
}

export default function Profile() {
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
  const [tab, setTab] = useState<ProfileTab>("progress");
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
  const [profileSaving, setProfileSaving] = useState(false);
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
      };
    }
    const best = Math.max(...scores.map((s) => s.split_score));
    const sum = scores.reduce((a, s) => a + s.split_score, 0);
    const avg = sum / scores.length;
    const t7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last7 = scores.filter((s) => new Date(s.created_at).getTime() >= t7)
      .length;
    const dialPct = Math.min(100, Math.max(0, (avg / 5) * 100));
    return {
      count: scores.length,
      best,
      avg,
      last7,
      dialPct,
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
          .select("id, slug, split_score, created_at, bar_name")
          .ilike("email", pattern)
          .order("created_at", { ascending: false })
          .limit(40);
        if (scoresQerr || !scoreRows?.length) {
          const { data: fallbackRows } = await supabase
            .from("scores")
            .select("id, slug, split_score, created_at, bar_name")
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
        .select("display_name, nickname")
        .eq("user_id", u.id)
        .maybeSingle();

      let prof = (profRes.data ?? null) as PublicProfileRow | null;
      let profErr = profRes.error;

      if (profErr) {
        const msg = `${profErr.message ?? ""} ${profErr.code ?? ""}`.toLowerCase();
        const likelyMissingNickCol =
          msg.includes("nickname") || msg.includes("column") || profErr.code === "42703";
        if (likelyMissingNickCol) {
          const r2 = await supabase
            .from("public_profiles")
            .select("display_name")
            .eq("user_id", u.id)
            .maybeSingle();
          prof = (r2.data ?? null) as PublicProfileRow | null;
          profErr = r2.error;
        }
      }

      if (profErr) {
        setFullName(fromGoogle);
        setNickname("");
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
      } else {
        setFullName(prof.display_name?.trim() || fromGoogle);
        const rawNick = "nickname" in prof ? prof.nickname : null;
        setNickname(
          rawNick != null && String(rawNick).trim() !== ""
            ? String(rawNick).trim()
            : "",
        );
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
        const { error: e1 } = await supabase.from("user_friends").insert({
          user_id: row.from_user_id,
          friend_user_id: user.id,
          peer_email: accepterEmail,
        });
        const { error: e2 } = await supabase.from("user_friends").insert({
          user_id: user.id,
          friend_user_id: row.from_user_id,
          peer_email: requesterEmail,
        });
        if (e1 || e2) {
          setMessage(e1?.message || e2?.message || "Could not save friendship.");
          return;
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

            <section className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/35 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="type-card-title">Friends & invites</h2>
                  <p className="type-meta mt-2 text-guinness-tan/75">
                    Invite people by email from here. If they create an account later
                    with that same email, they&apos;ll see the pending friend request and
                    any competition invites. They still choose whether to accept the
                    friendship or join the competition.
                  </p>
                </div>
                <div className="grid w-full gap-3 lg:max-w-xl lg:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="email"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    placeholder="friend@email.com"
                    className={inputClass}
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendFriendRequest()}
                    className="min-h-11 rounded-lg bg-guinness-gold px-5 py-2.5 font-semibold text-guinness-black hover:bg-guinness-tan disabled:opacity-50 lg:min-w-[10rem]"
                  >
                    Send request
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Friends", value: acceptedFriends.length },
                  { label: "Incoming", value: incomingRequests.length },
                  { label: "Pending", value: outgoingRequests.length },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setTab("friends")}
                    className="rounded-xl border border-[#372C16] bg-guinness-black/30 px-4 py-3 text-left transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinness-gold"
                    aria-label={`${item.label}: ${item.value}. Open Friends tab.`}
                  >
                    <p className="type-meta text-guinness-tan/65">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">
                      {item.value}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <div
              className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4"
              role="group"
              aria-label="Profile sections"
            >
              {[
                { key: "progress", label: "Progress" },
                { key: "scores", label: "Scores" },
                { key: "favorites", label: "Favorite bars" },
                { key: "friends", label: "Friends" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key as ProfileTab)}
                  className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors sm:px-4 ${
                    tab === item.key
                      ? "bg-guinness-gold text-guinness-black"
                      : "border border-guinness-gold/20 bg-guinness-black/35 text-guinness-tan/80 hover:text-guinness-cream"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "progress" ? (
              <div className="space-y-8">
                {scores.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        { label: "Pours", value: String(progressStats.count) },
                        { label: "Best", value: progressStats.best.toFixed(2) },
                        { label: "Avg / 5", value: progressStats.avg.toFixed(2) },
                        { label: "Last 7d", value: String(progressStats.last7) },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/35 p-4 text-center"
                        >
                          <p className="type-meta text-guinness-tan/70">{item.label}</p>
                          <p className="mt-1 text-3xl font-bold tabular-nums text-guinness-gold">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-guinness-gold/20 bg-guinness-brown/30 p-4 sm:p-6">
                      <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-center">
                        <div className="mx-auto flex w-full max-w-[16rem] flex-col items-center gap-3">
                          <div className="profile-progress-shell">
                            <div className="profile-progress-glow" />
                            <div className="profile-progress-orbit" />
                            <div
                              className="relative flex h-44 w-44 items-center justify-center rounded-full border border-guinness-gold/10 shadow-[inset_0_0_0_10px_rgba(9,9,7,0.7)]"
                              style={{
                                background: `conic-gradient(rgba(213,178,99,0.98) 0 ${progressStats.dialPct}%, rgba(255,255,255,0.06) ${progressStats.dialPct}% 100%)`,
                              }}
                              aria-hidden
                            >
                              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-guinness-gold/10 bg-guinness-black/95 shadow-[0_0_22px_rgba(0,0,0,0.45)]">
                                <span className="type-meta text-guinness-tan/70">Average</span>
                                <span className="text-3xl font-bold tabular-nums text-guinness-gold">
                                  {progressStats.avg.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="type-meta text-center text-guinness-tan/75">
                            Last 7 days:{" "}
                            <span className="font-semibold text-guinness-cream">
                              {progressStats.last7}
                            </span>{" "}
                            pour(s)
                          </p>
                        </div>

                        <div className="space-y-4">
                          {[
                            {
                              label: "Average",
                              value: progressStats.avg,
                              accent: "bg-guinness-gold",
                            },
                            {
                              label: "Best",
                              value: progressStats.best,
                              accent: "bg-guinness-cream",
                            },
                            {
                              label: "Recent volume",
                              value: Math.min(progressStats.last7, 5),
                              accent: "bg-guinness-tan",
                              suffix: ` (${progressStats.last7} in 7d)`,
                            },
                          ].map((item) => (
                            <div key={item.label} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-guinness-cream">
                                  {item.label}
                                </span>
                                <span className="type-meta text-guinness-tan/70">
                                  {item.value.toFixed(2)}
                                  {item.suffix ?? " / 5.00"}
                                </span>
                              </div>
                              <div className="h-3 overflow-hidden rounded-full bg-guinness-black/60">
                                <div
                                  className={`h-full rounded-full ${item.accent}`}
                                  style={{
                                    width: `${Math.max(8, Math.min(100, (item.value / 5) * 100))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <section className="rounded-2xl border border-guinness-gold/20 bg-guinness-brown/30 p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="type-card-title">Friends leaderboard</h2>
                          <p className="type-meta mt-1 text-guinness-tan/70">
                            Compare your average, best score, and volume against accepted
                            friends.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {progressRangeOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setProgressRange(option.value)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                                progressRange === option.value
                                  ? "bg-guinness-gold text-guinness-black"
                                  : "border border-guinness-gold/20 text-guinness-tan/75 hover:text-guinness-cream"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {friendProgressLeaderboard.length > 0 ? (
                        <ol className="mt-5 space-y-2">
                          {friendProgressLeaderboard.slice(0, 8).map((entry, index) => (
                            <li
                              key={entry.email}
                              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[auto_minmax(0,1.3fr)_repeat(3,auto)] sm:gap-4 ${
                                entry.isCurrentUser
                                  ? "border-guinness-gold/35 bg-guinness-gold/10"
                                  : "border-guinness-gold/10 bg-guinness-black/30"
                              }`}
                            >
                              <span className="text-sm font-semibold tabular-nums text-guinness-gold">
                                #{index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-guinness-cream">
                                  {entry.label}
                                  {entry.isCurrentUser ? " · You" : ""}
                                </p>
                                <p className="type-meta truncate text-guinness-tan/60">
                                  {entry.email}
                                </p>
                              </div>
                              <span className="text-sm tabular-nums text-guinness-tan/80 sm:text-right">
                                {entry.pours} pours
                              </span>
                              <span className="hidden text-sm tabular-nums text-guinness-tan/80 sm:block">
                                Avg {entry.avg.toFixed(2)}
                              </span>
                              <span className="hidden text-sm tabular-nums text-guinness-tan/80 sm:block">
                                Best {entry.best.toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="type-meta mt-5 text-guinness-tan/70">
                          Accept a few friends to unlock side-by-side progress comparisons.
                        </p>
                      )}
                    </section>
                  </>
                ) : (
                  <p className="type-meta text-guinness-tan/70">
                    No scores linked to this email yet. Open a result you own and tap
                    &quot;Claim with Google&quot;.
                  </p>
                )}
              </div>
            ) : tab === "scores" ? (
              scores.length > 0 ? (
                <section>
                  <h2 className="type-card-title mb-3">Recent scores</h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {scores.map((s) => (
                      <li key={s.id}>
                        <Link
                          to={scorePourPathFromFields(s)}
                          prefetch="intent"
                          viewTransition
                          className="block rounded-xl border border-guinness-gold/15 bg-guinness-brown/30 p-4 transition-colors hover:border-guinness-gold/35"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-2xl font-bold tabular-nums text-guinness-gold">
                              {s.split_score.toFixed(2)}
                            </span>
                            <span className="type-meta text-guinness-tan/65">
                              {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {s.bar_name ? (
                            <p className="type-meta mt-2 text-guinness-tan/55">
                              {s.bar_name}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="type-meta text-guinness-tan/70">
                  No scores linked to this email yet. Claim a pour to start a score log.
                </p>
              )
            ) : tab === "favorites" ? (
              <section className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/40 p-4 sm:p-6">
                <h2 className="type-card-title mb-1">Favorite bars</h2>
                <p className="type-meta mb-4 text-guinness-tan/65">
                  Save pubs you visit; we use Places for accurate addresses.
                </p>
                <form
                  onSubmit={(ev) => void addFavorite(ev)}
                  className="space-y-3"
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                      <label
                        htmlFor="fav-bar-search"
                        className="type-label mb-1.5 block text-guinness-tan/85"
                      >
                        Search (Google Places)
                      </label>
                      <PlacesAutocomplete
                        initialValue={favName}
                        onChangeText={setFavName}
                        onSelect={(p) => {
                          setFavName(p.name);
                          setFavAddress(p.address);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="h-11 w-full shrink-0 rounded-lg bg-guinness-gold px-6 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 lg:min-w-[10.5rem]"
                    >
                      Save favorite
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-guinness-tan/55">
                    Choose a suggestion when possible so we store the full
                    address.
                  </p>
                </form>

                {favorites.length > 0 ? (
                  <ul className="mt-5 space-y-2 border-t border-guinness-gold/15 pt-5">
                    {favorites.map((f) => {
                      const stats =
                        favoriteStats[barKey(f.bar_name, f.bar_address)] ??
                        favoriteStats[barKey(f.bar_name)] ??
                        null;
                      return (
                        <li
                          key={f.id}
                          className="rounded-lg border border-[#372C16] bg-guinness-black/35 p-3 sm:p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <p className="font-semibold leading-snug text-guinness-cream">
                                  {f.bar_name}
                                </p>
                                {stats ? (
                                  <span className="rounded-full bg-guinness-gold/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-guinness-gold">
                                    {stats.avg.toFixed(1)} · {stats.count} rated
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-guinness-tan/60">
                                    No ratings yet
                                  </span>
                                )}
                              </div>
                              {f.bar_address ? (
                                <p className="type-meta mt-1 line-clamp-2 text-guinness-tan/60">
                                  {f.bar_address}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:justify-end">
                              <a
                                href={favoriteMapsUrl(f)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex flex-1 items-center justify-center rounded-lg border border-guinness-gold/30 px-3 py-2 text-xs font-medium text-guinness-gold hover:bg-guinness-gold/10 sm:flex-initial"
                              >
                                Maps
                              </a>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void removeFavorite(f.id)}
                                className="inline-flex flex-1 items-center justify-center rounded-lg border border-red-400/45 px-3 py-2 text-xs font-medium text-red-400/95 hover:bg-red-950/25 sm:flex-initial"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="type-meta mt-6 text-guinness-tan/65">
                    No favorites yet.
                  </p>
                )}
              </section>
            ) : (
              <section className="space-y-5">
                {incomingRequests.length > 0 ? (
                  <div className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/30 p-5">
                    <h2 className="type-card-title">Incoming requests</h2>
                    <ul className="mt-4 space-y-3">
                      {incomingRequests.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-col gap-3 rounded-xl border border-guinness-gold/10 bg-guinness-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-guinness-cream">
                              {r.from_email || "Someone wants to connect"}
                            </p>
                            <p className="type-meta mt-1 text-guinness-tan/65">
                              Sent {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void respondRequest(r, "accepted")}
                              className="rounded-lg bg-guinness-gold px-3 py-2 text-xs font-semibold text-guinness-black"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void respondRequest(r, "declined")}
                              className="rounded-lg border border-guinness-gold/25 px-3 py-2 text-xs font-semibold text-guinness-tan"
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/30 p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="type-card-title">Your friends</h2>
                      <p className="type-meta mt-1 text-guinness-tan/70">
                        Accepted friends appear here with a quick performance snapshot.
                      </p>
                    </div>
                    <p className="type-meta text-guinness-tan/55">
                      {acceptedFriends.length} accepted
                    </p>
                  </div>
                  {acceptedFriends.length > 0 ? (
                    <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                      {acceptedFriends.map((f) => {
                        const email = f.peer_email ? normalizeEmail(f.peer_email) : null;
                        const stats = email ? allTimeFriendStatsByEmail[email] : null;
                        return (
                          <li
                            key={`${f.user_id}-${f.friend_user_id}`}
                            className="rounded-xl border border-guinness-gold/10 bg-guinness-black/30 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-guinness-cream">
                                  {stats?.label ||
                                    f.peer_email ||
                                    `Player ${f.friend_user_id.slice(0, 8)}…`}
                                </p>
                                <p className="type-meta mt-1 truncate text-guinness-tan/60">
                                  {f.peer_email || "No email linked yet"}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void removeFriendship(f)}
                                className="shrink-0 rounded-lg border border-red-400/35 px-3 py-1.5 text-xs font-semibold text-red-400/90 hover:bg-red-950/25"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2">
                              <div className="rounded-lg bg-guinness-brown/35 px-3 py-2">
                                <p className="type-meta text-guinness-tan/55">Pours</p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-guinness-gold">
                                  {stats?.pours ?? 0}
                                </p>
                              </div>
                              <div className="rounded-lg bg-guinness-brown/35 px-3 py-2">
                                <p className="type-meta text-guinness-tan/55">Avg</p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-guinness-gold">
                                  {stats ? stats.avg.toFixed(2) : "—"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-guinness-brown/35 px-3 py-2">
                                <p className="type-meta text-guinness-tan/55">Best</p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-guinness-gold">
                                  {stats ? stats.best.toFixed(2) : "—"}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="type-meta mt-4 text-guinness-tan/70">
                      No accepted friends yet. Send a few requests above.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-guinness-gold/20 bg-guinness-brown/30 p-5">
                  <h2 className="type-card-title">Pending sent</h2>
                  {outgoingRequests.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm text-guinness-tan/75">
                      {outgoingRequests.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-guinness-gold/10 bg-guinness-black/25 px-3 py-2"
                        >
                          {String(r.to_email)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="type-meta mt-4 text-guinness-tan/70">
                      No pending requests right now.
                    </p>
                  )}
                </div>
              </section>
            )}
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
