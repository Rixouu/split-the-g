import { Link, useLoaderData, useParams, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PageHeader,
  competitionDetailPageDescription,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { BrandedToast } from "~/components/branded/BrandedToast";
import {
  competitionDetailMessageVariant,
  toastAutoCloseForVariant,
} from "~/components/branded/feedback-variant";
import { supabase } from "~/utils/supabase";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { pubDetailPath } from "~/utils/pubPath";
import type { CompetitionRow } from "~/routes/competitions";

type WinRule = CompetitionRow["win_rule"];

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

type ScoreSnippet = {
  id: string;
  slug?: string | null;
  username: string | null;
  split_score: number;
  created_at: string;
  email?: string | null;
};

type ParticipantProfilePick = {
  nickname?: string | null;
  display_name?: string | null;
};

type CompetitionScoreJoin = {
  id: string;
  user_id: string | null;
  score_id: string;
  created_at: string;
  scores: ScoreSnippet | ScoreSnippet[] | null;
};

function unwrapScore(
  s: ScoreSnippet | ScoreSnippet[] | null | undefined,
): ScoreSnippet | null {
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function winRuleLabel(rule: string): string {
  switch (rule) {
    case "closest_to_target":
      return "Closest to target";
    case "most_submissions":
      return "Most submissions";
    case "highest_score":
    default:
      return "Highest score";
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

type PourEntry = {
  value: number;
  at: number;
  scoreId: string;
  slug: string | null;
};

type RankedRow = {
  rank: number;
  userId: string;
  username: string;
  metric: string;
  detail: string;
  pourPath: string;
};

function pickRepresentativePour(pours: PourEntry[]): PourEntry {
  let best = pours[0];
  for (const p of pours) {
    if (
      p.value > best.value ||
      (p.value === best.value && p.at < best.at)
    ) {
      best = p;
    }
  }
  return best;
}

function buildLeaderboard(
  rows: CompetitionScoreJoin[],
  winRule: WinRule,
  targetScore: number | null,
): RankedRow[] {
  type Agg = {
    userId: string;
    username: string;
    pours: PourEntry[];
  };
  const map = new Map<string, Agg>();

  for (const row of rows) {
    const scoreRow = unwrapScore(row.scores);
    if (!scoreRow) continue;
    const uid = row.user_id ?? "";
    if (!uid) continue;
    const prev = map.get(uid);
    const username = scoreRow.username?.trim() || "Player";
    const value = Number(scoreRow.split_score);
    const at = new Date(scoreRow.created_at).getTime();
    const pour: PourEntry = {
      value,
      at,
      scoreId: row.score_id,
      slug: scoreRow.slug ?? null,
    };
    if (!prev) {
      map.set(uid, {
        userId: uid,
        username,
        pours: [pour],
      });
    } else {
      prev.pours.push(pour);
    }
  }

  const list = [...map.values()];

  if (winRule === "most_submissions") {
    return list
      .map((a) => {
        const bestVal = Math.max(...a.pours.map((x) => x.value));
        const linkPour = pickRepresentativePour(a.pours);
        return {
          userId: a.userId,
          username: a.username,
          sortKey: a.pours.length,
          tie: bestVal,
          metric: `${a.pours.length} pour(s)`,
          detail: `Best ${bestVal.toFixed(2)} / 5`,
          pourPath: scorePourPathFromFields({
            id: linkPour.scoreId,
            slug: linkPour.slug,
          }),
        };
      })
      .sort((x, y) =>
        y.sortKey !== x.sortKey
          ? y.sortKey - x.sortKey
          : y.tie !== x.tie
            ? y.tie - x.tie
            : x.username.localeCompare(y.username),
      )
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        metric: r.metric,
        detail: r.detail,
        pourPath: r.pourPath,
      }));
  }

  if (winRule === "closest_to_target" && targetScore != null && Number.isFinite(targetScore)) {
    return list
      .map((a) => {
        let bestDist = Infinity;
        let bestScore = 0;
        let bestAt = Infinity;
        let linkPour = a.pours[0];
        for (const s of a.pours) {
          const d = Math.abs(s.value - targetScore);
          if (
            d < bestDist ||
            (d === bestDist && s.value > bestScore) ||
            (d === bestDist && s.value === bestScore && s.at < bestAt)
          ) {
            bestDist = d;
            bestScore = s.value;
            bestAt = s.at;
            linkPour = s;
          }
        }
        return {
          userId: a.userId,
          username: a.username,
          sortKey: bestDist,
          tie: -bestScore,
          tie2: bestAt,
          metric: `Δ ${bestDist.toFixed(2)} from ${targetScore.toFixed(2)}`,
          detail: `Score ${bestScore.toFixed(2)} / 5`,
          pourPath: scorePourPathFromFields({
            id: linkPour.scoreId,
            slug: linkPour.slug,
          }),
        };
      })
      .sort((x, y) =>
        x.sortKey !== y.sortKey
          ? x.sortKey - y.sortKey
          : x.tie !== y.tie
            ? x.tie - y.tie
            : x.tie2 - y.tie2,
      )
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        metric: r.metric,
        detail: r.detail,
        pourPath: r.pourPath,
      }));
  }

  // highest_score (default)
  return list
    .map((a) => {
      const linkPour = pickRepresentativePour(a.pours);
      return {
        userId: a.userId,
        username: a.username,
        sortKey: linkPour.value,
        tie: linkPour.at,
        metric: `${linkPour.value.toFixed(2)} / 5`,
        detail: "Best pour",
        pourPath: scorePourPathFromFields({
          id: linkPour.scoreId,
          slug: linkPour.slug,
        }),
      };
    })
    .sort((x, y) =>
      y.sortKey !== x.sortKey
        ? y.sortKey - x.sortKey
        : x.tie - y.tie,
    )
    .map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      metric: r.metric,
      detail: r.detail,
      pourPath: r.pourPath,
    }));
}

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.competitionId?.trim();
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return {
    competitionId: id,
    competition: (data ?? null) as CompetitionRow | null,
    loadError: error?.message ?? null,
  };
}

export default function CompetitionDetail() {
  const { competitionId, competition: loaderComp, loadError } =
    useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const params = useParams();

  const [competition, setCompetition] = useState<CompetitionRow | null>(
    loaderComp,
  );
  const [joined, setJoined] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [scoresJoined, setScoresJoined] = useState<CompetitionScoreJoin[]>([]);
  const [myScores, setMyScores] = useState<
    { id: string; split_score: number; created_at: string; bar_name: string | null }[]
  >([]);
  const [submittedScoreIds, setSubmittedScoreIds] = useState<Set<string>>(
    new Set(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [participantUserIds, setParticipantUserIds] = useState<string[]>([]);
  const [participantProfiles, setParticipantProfiles] = useState<
    Record<string, ParticipantProfilePick>
  >({});
  const [friendPeerIds, setFriendPeerIds] = useState<Set<string>>(() => new Set());
  const [pendingFriendEmails, setPendingFriendEmails] = useState<Set<string>>(
    () => new Set(),
  );
  const [friendInviteBusy, setFriendInviteBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshAll = useCallback(async () => {
    const id = competitionId;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const em = auth.user?.email?.trim() ?? null;
    const emNorm = em ? normalizeEmail(em) : null;
    setUserId(uid);
    setUserEmail(em);

    const { data: compRows } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (compRows) setCompetition(compRows as CompetitionRow);

    const { data: allParts } = await supabase
      .from("competition_participants")
      .select("user_id")
      .eq("competition_id", id);
    const partIds = [
      ...new Set(
        (allParts ?? [])
          .map((r) => r.user_id as string | null)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    setParticipantUserIds(partIds);

    if (partIds.length > 0) {
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("user_id, nickname, display_name")
        .in("user_id", partIds);
      const map: Record<string, ParticipantProfilePick> = {};
      for (const p of profs ?? []) {
        const u = p.user_id as string;
        map[u] = {
          nickname: p.nickname as string | null | undefined,
          display_name: p.display_name as string | null | undefined,
        };
      }
      setParticipantProfiles(map);
    } else {
      setParticipantProfiles({});
    }

    if (uid) {
      const { data: part } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .eq("competition_id", id)
        .eq("user_id", uid)
        .maybeSingle();
      setJoined(Boolean(part));
    } else {
      setJoined(false);
    }

    if (uid && emNorm) {
      const [{ data: fr }, { data: outReq }] = await Promise.all([
        supabase
          .from("user_friends")
          .select("user_id, friend_user_id")
          .or(`user_id.eq.${uid},friend_user_id.eq.${uid}`),
        supabase
          .from("friend_requests")
          .select("to_email")
          .eq("from_user_id", uid)
          .eq("status", "pending"),
      ]);
      const peers = new Set<string>();
      for (const row of fr ?? []) {
        if (row.user_id === uid) peers.add(row.friend_user_id as string);
        else if (row.friend_user_id === uid) peers.add(row.user_id as string);
      }
      setFriendPeerIds(peers);
      const pending = new Set<string>();
      for (const row of outReq ?? []) {
        const t = normalizeEmail(String(row.to_email ?? ""));
        if (t) pending.add(t);
      }
      setPendingFriendEmails(pending);
    } else {
      setFriendPeerIds(new Set());
      setPendingFriendEmails(new Set());
    }

    const { data: csRows } = await supabase
      .from("competition_scores")
      .select(
        "id, user_id, score_id, created_at, scores (id, slug, username, split_score, created_at, email)",
      )
      .eq("competition_id", id);

    const list = (csRows ?? []) as CompetitionScoreJoin[];
    setScoresJoined(list);
    setSubmittedScoreIds(new Set(list.map((r) => r.score_id)));

    if (em) {
      const { data: mine } = await supabase
        .from("scores")
        .select("id, split_score, created_at, bar_name")
        .eq("email", em)
        .order("created_at", { ascending: false })
        .limit(40);
      setMyScores((mine ?? []) as typeof myScores);
    } else {
      setMyScores([]);
    }
  }, [competitionId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll, revalidator.state]);

  useEffect(() => {
    if (loaderComp) setCompetition(loaderComp);
  }, [loaderComp]);

  const ranked = useMemo(() => {
    if (!competition) return [];
    const target =
      competition.target_score != null
        ? Number(competition.target_score)
        : null;
    return buildLeaderboard(
      scoresJoined,
      competition.win_rule as WinRule,
      target,
    );
  }, [competition, scoresJoined]);

  const emailByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of scoresJoined) {
      const uid = row.user_id;
      if (!uid) continue;
      const s = unwrapScore(row.scores);
      const raw = s?.email?.trim();
      if (!raw) continue;
      if (!m.has(uid)) m.set(uid, raw);
    }
    return m;
  }, [scoresJoined]);

  const rankedUsernameByUserId = useMemo(
    () => new Map(ranked.map((r) => [r.userId, r.username])),
    [ranked],
  );

  const sortedParticipantUserIds = useMemo(() => {
    const ids = [...participantUserIds];
    function labelFor(uid: string): string {
      const p = participantProfiles[uid];
      return (
        p?.nickname?.trim() ||
        p?.display_name?.trim() ||
        rankedUsernameByUserId.get(uid) ||
        "Player"
      );
    }
    ids.sort((a, b) => {
      if (userId) {
        if (a === userId) return -1;
        if (b === userId) return 1;
      }
      return labelFor(a).localeCompare(labelFor(b), undefined, {
        sensitivity: "base",
      });
    });
    return ids;
  }, [participantUserIds, participantProfiles, rankedUsernameByUserId, userId]);

  const sendFriendInviteToPeer = useCallback(
    async (toEmail: string, peerUserId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user;
      if (!me?.id || !me.email) {
        setMessage("Sign in to add friends.");
        return;
      }
      const to = normalizeEmail(toEmail);
      if (!to.includes("@")) {
        setMessage("We don’t have an email on file for that player.");
        return;
      }
      if (to === normalizeEmail(me.email)) return;

      setFriendInviteBusy(peerUserId);
      setMessage(null);
      try {
        const alreadyPending = pendingFriendEmails.has(to);
        if (!alreadyPending) {
          const { error } = await supabase.from("friend_requests").insert({
            from_user_id: me.id,
            to_email: to,
            from_email: me.email ?? null,
            status: "pending",
          });
          if (error) {
            setMessage(error.message);
            return;
          }
          setPendingFriendEmails((prev) => new Set(prev).add(to));
        }

        const inviterName =
          (me.user_metadata?.full_name as string | undefined)?.trim() ||
          (me.user_metadata?.name as string | undefined)?.trim() ||
          null;

        const emailResponse = await fetch("/api/friend-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviterEmail: me.email,
            inviterName,
            toEmail: to,
          }),
        });

        if (!emailResponse.ok) {
          const emailResult = (await emailResponse.json().catch(() => null)) as
            | { error?: string }
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
      } finally {
        setFriendInviteBusy(null);
      }
    },
    [pendingFriendEmails],
  );

  const participantLabel = useCallback(
    (uid: string) => {
      const p = participantProfiles[uid];
      return (
        p?.nickname?.trim() ||
        p?.display_name?.trim() ||
        rankedUsernameByUserId.get(uid) ||
        "Player"
      );
    },
    [participantProfiles, rankedUsernameByUserId],
  );

  const friendActionForPeer = useCallback(
    (peerUserId: string): ReactNode => {
      if (!userId || peerUserId === userId) return null;
      if (friendPeerIds.has(peerUserId)) {
        return (
          <span className="type-meta text-xs text-emerald-400/90">Friends</span>
        );
      }
      const claimEmail = emailByUserId.get(peerUserId) ?? null;
      if (!claimEmail) {
        return (
          <span className="type-meta max-w-[11rem] text-right text-xs leading-snug text-guinness-tan/50">
            Email visible after they submit a pour here
          </span>
        );
      }
      const norm = normalizeEmail(claimEmail);
      if (userEmail && norm === normalizeEmail(userEmail)) return null;
      if (pendingFriendEmails.has(norm)) {
        return (
          <span className="type-meta text-xs text-guinness-tan/60">
            Request pending
          </span>
        );
      }
      return (
        <button
          type="button"
          disabled={friendInviteBusy === peerUserId}
          onClick={() => void sendFriendInviteToPeer(claimEmail, peerUserId)}
          className="rounded-lg border border-guinness-gold/35 px-2.5 py-1 text-xs font-semibold text-guinness-gold hover:bg-guinness-brown/45 disabled:opacity-50"
        >
          {friendInviteBusy === peerUserId ? "…" : "Add friend"}
        </button>
      );
    },
    [
      userId,
      userEmail,
      friendPeerIds,
      emailByUserId,
      pendingFriendEmails,
      friendInviteBusy,
      sendFriendInviteToPeer,
    ],
  );

  const timePhase = useMemo(() => {
    if (!competition) return null;
    const now = Date.now();
    const start = new Date(competition.starts_at).getTime();
    const end = new Date(competition.ends_at).getTime();
    if (now < start) return { phase: "before" as const, ms: start - now };
    if (now > end) return { phase: "after" as const, ms: 0 };
    return { phase: "live" as const, ms: end - now };
  }, [competition, tick]);

  async function handleJoin() {
    setMessage(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setMessage("Sign in to join.");
      return;
    }
    const { error } = await supabase.from("competition_participants").insert({
      competition_id: competitionId,
      user_id: u.user.id,
    });
    if (error) setMessage(error.message);
    else {
      setJoined(true);
      revalidator.revalidate();
      void refreshAll();
      setMessage("You’re in! Welcome to the competition.");
    }
  }

  async function handleLeave() {
    setMessage(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("competition_participants")
      .delete()
      .eq("competition_id", competitionId)
      .eq("user_id", u.user.id);
    if (error) setMessage(error.message);
    else {
      setJoined(false);
      revalidator.revalidate();
      void refreshAll();
      setMessage("You’ve left this competition.");
    }
  }

  async function submitScore(scoreId: string) {
    setMessage(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setMessage("Sign in to submit.");
      return;
    }
    setSubmitBusy(scoreId);
    const { error } = await supabase.from("competition_scores").insert({
      competition_id: competitionId,
      score_id: scoreId,
      user_id: u.user.id,
    });
    setSubmitBusy(null);
    if (error) setMessage(error.message);
    else {
      revalidator.revalidate();
      void refreshAll();
      setMessage("Pour submitted to this competition.");
    }
  }

  if (!params.competitionId) {
    return null;
  }

  if (loadError && !competition) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-red-400/90">{loadError}</p>
          <Link
            to="/competitions"
            viewTransition
            className="mt-4 inline-block text-guinness-gold underline"
          >
            Back to competitions
          </Link>
        </div>
      </main>
    );
  }

  if (!competition) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-guinness-tan/70">Loading competition…</p>
        </div>
      </main>
    );
  }

  const isPrivate = (competition.visibility ?? "public") === "private";
  const canSubmit =
    joined &&
    timePhase?.phase === "live" &&
    userId;

  const availableToSubmit = myScores.filter(
    (s) => !submittedScoreIds.has(s.id),
  );

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title={competition.title} description={competitionDetailPageDescription}>
          <Link
            to="/competitions"
            viewTransition
            className={pageHeaderActionButtonClass}
          >
            All competitions
          </Link>
        </PageHeader>

        {joined ? (
          <div
            className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.08] px-4 py-3 sm:items-center sm:gap-4"
            role="status"
            aria-label="You are a participant in this competition"
          >
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-300 sm:mt-0"
              aria-hidden
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-guinness-cream">
                You&apos;re in this competition
              </p>
              <p className="type-meta mt-1 text-guinness-tan/80">
                Your pours count toward this board while the window is live. We&apos;ll
                notify you when someone else submits a pour.
              </p>
            </div>
          </div>
        ) : null}

        <section className="mb-8" aria-labelledby="comp-overview-heading">
          <h2 id="comp-overview-heading" className="type-card-title mb-3">
            Overview
          </h2>
          <div className="rounded-2xl border border-guinness-gold/15 bg-guinness-brown/25 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-guinness-gold/10 pb-3 text-sm text-guinness-tan/80">
              <span className="font-semibold text-guinness-gold">
                {winRuleLabel(competition.win_rule)}
                {competition.win_rule === "closest_to_target" &&
                competition.target_score != null
                  ? ` · target ${Number(competition.target_score).toFixed(2)}`
                  : ""}
              </span>
              <span className="text-guinness-tan/50" aria-hidden>
                ·
              </span>
              <span>{isPrivate ? "Private" : "Public"}</span>
            </div>
            {competition.linked_bar_key?.trim() ? (
              <p className="type-meta mt-2 text-guinness-tan/75">
                Linked pub:{" "}
                <Link
                  to={pubDetailPath(competition.linked_bar_key.trim())}
                  viewTransition
                  className="font-medium text-guinness-gold underline decoration-guinness-gold/40 underline-offset-2 hover:decoration-guinness-gold"
                >
                  Open pub page
                </Link>
              </p>
            ) : null}
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3">
                <dt className="type-meta text-guinness-tan/65">Status</dt>
                <dd className="mt-1 text-lg font-semibold text-guinness-gold">
                  {timePhase?.phase === "before"
                    ? "Not started"
                    : timePhase?.phase === "live"
                      ? "Live"
                      : "Ended"}
                </dd>
              </div>
              <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3">
                <dt className="type-meta text-guinness-tan/65">
                  {timePhase?.phase === "before"
                    ? "Starts in"
                    : timePhase?.phase === "live"
                      ? "Ends in"
                      : "Finished"}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream">
                  {timePhase?.phase === "after"
                    ? "—"
                    : timePhase
                      ? formatDuration(timePhase.ms)
                      : "—"}
                </dd>
              </div>
              <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3 sm:col-span-2 lg:col-span-1">
                <dt className="type-meta text-guinness-tan/65">Window</dt>
                <dd className="mt-1 text-xs leading-relaxed text-guinness-tan/85">
                  {new Date(competition.starts_at).toLocaleString()} →{" "}
                  {new Date(competition.ends_at).toLocaleString()}
                </dd>
              </div>
              <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3 sm:col-span-2 lg:col-span-1">
                <dt className="type-meta text-guinness-tan/65">Participants</dt>
                <dd className="mt-1">
                  <p className="text-lg font-semibold tabular-nums text-guinness-cream">
                    {participantUserIds.length} / {competition.max_participants}{" "}
                    joined
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/60">
                    Up to {competition.max_participants} people ·{" "}
                    {competition.glasses_per_person} glass
                    {competition.glasses_per_person === 1 ? "" : "es"} each
                  </p>
                </dd>
              </div>
            </dl>
            <div className="mt-4 rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3">
              <p className="type-meta text-guinness-tan/65">Location</p>
              <div className="mt-1 text-sm leading-relaxed text-guinness-cream">
                {competition.location_name?.trim() ||
                competition.location_address?.trim() ? (
                  <>
                    {competition.location_name?.trim() ? (
                      <span className="font-semibold text-guinness-gold">
                        {competition.location_name.trim()}
                      </span>
                    ) : null}
                    {competition.location_name?.trim() &&
                    competition.location_address?.trim() ? (
                      <span className="mt-1 block text-guinness-tan/85">
                        {competition.location_address.trim()}
                      </span>
                    ) : competition.location_address?.trim() ? (
                      <span>{competition.location_address.trim()}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-guinness-tan/55">Not specified</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          className="mb-8"
          aria-label="Competition actions"
        >
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {!userId ? (
            <p className="type-meta text-guinness-tan/70">
              Sign in (Profile) to join or submit pours.
            </p>
          ) : joined ? (
            <>
              <button
                type="button"
                onClick={() => void handleLeave()}
                className="rounded-lg border border-guinness-gold/30 px-4 py-2 text-sm font-medium text-guinness-tan hover:bg-guinness-brown/50"
              >
                Leave competition
              </button>
              {canSubmit ? (
                <Link
                  to={`/?competition=${encodeURIComponent(competitionId)}`}
                  viewTransition
                  className={pageHeaderActionButtonClass}
                >
                  New pour for comp
                </Link>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleJoin()}
              className={pageHeaderActionButtonClass}
            >
              Join competition
            </button>
          )}
        </div>
        </section>

        <section
          className="mb-8"
          aria-labelledby="comp-participants-heading"
        >
          <h2 id="comp-participants-heading" className="type-card-title mb-1">
            Who&apos;s in
          </h2>
          <p className="type-meta mb-4 text-guinness-tan/70">
            {userId
              ? "People who joined this competition. Add friends when you see their pour email on the board."
              : "Sign in to see friend actions. Participant count is always visible above."}
          </p>
          {sortedParticipantUserIds.length === 0 ? (
            <p className="type-meta text-guinness-tan/60">
              No participants yet — be the first to join.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedParticipantUserIds.map((pid) => (
                <li
                  key={pid}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-guinness-gold/12 bg-guinness-brown/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-guinness-cream">
                      {participantLabel(pid)}
                      {userId && pid === userId ? (
                        <span className="type-meta ml-2 font-normal text-guinness-tan/55">
                          (you)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-end">
                    {friendActionForPeer(pid)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {joined && userEmail && timePhase?.phase === "live" ? (
          <section className="mb-10 rounded-2xl border border-guinness-gold/20 bg-guinness-brown/30 p-5">
            <h2 className="type-card-title mb-3">Submit an existing score</h2>
            <p className="type-meta mb-4 text-guinness-tan/75">
              Only scores claimed to your email can be submitted. Each score
              can only be used once in this competition.
            </p>
            {availableToSubmit.length === 0 ? (
              <p className="type-meta text-guinness-tan/60">
                No eligible scores left — pour a new one with the button above.
              </p>
            ) : (
              <ul className="space-y-2">
                {availableToSubmit.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-guinness-gold/15 bg-guinness-black/35 px-3 py-2"
                  >
                    <div>
                      <span className="font-semibold text-guinness-gold tabular-nums">
                        {s.split_score.toFixed(2)}
                      </span>
                      <span className="type-meta ml-2 text-guinness-tan/70">
                        {new Date(s.created_at).toLocaleDateString()}
                        {s.bar_name ? ` · ${s.bar_name}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={submitBusy === s.id}
                      onClick={() => void submitScore(s.id)}
                      className="rounded-lg bg-guinness-gold px-3 py-1.5 text-xs font-semibold text-guinness-black hover:bg-guinness-tan disabled:opacity-50"
                    >
                      {submitBusy === s.id ? "…" : "Submit"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section aria-labelledby="comp-leaderboard-heading">
          <h2 id="comp-leaderboard-heading" className="type-card-title mb-4">
            Leaderboard
          </h2>
          {ranked.length === 0 ? (
            <p className="type-meta text-guinness-tan/65">
              No submissions yet. Join and pour!
            </p>
          ) : (
            <ul className="space-y-2">
              {ranked.map((r) => (
                <li key={r.userId}>
                  <div className="flex flex-wrap items-stretch gap-0 rounded-xl border border-guinness-gold/15 bg-guinness-brown/35 transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/50">
                    <Link
                      to={r.pourPath}
                      viewTransition
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-guinness-gold"
                    >
                      <span className="w-8 shrink-0 text-lg font-bold text-guinness-gold">
                        #{r.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-guinness-cream">
                          {r.username}
                        </p>
                        <p className="type-meta text-guinness-tan/65">{r.detail}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 sm:hidden">
                        <p className="text-sm font-semibold text-guinness-gold">
                          {r.metric}
                        </p>
                        <span className="text-guinness-tan/45 text-xs" aria-hidden>
                          →
                        </span>
                      </div>
                    </Link>
                    <div className="flex min-w-[9rem] shrink-0 flex-col items-stretch justify-center gap-2 border-t border-guinness-gold/10 px-4 py-3 sm:border-l sm:border-t-0 sm:py-3">
                      <div className="hidden items-center justify-end gap-2 text-right sm:flex">
                        <p className="text-sm font-semibold text-guinness-gold">
                          {r.metric}
                        </p>
                        <span className="text-guinness-tan/45 text-xs" aria-hidden>
                          →
                        </span>
                      </div>
                      <div className="flex justify-end sm:justify-end">
                        {friendActionForPeer(r.userId)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BrandedToast
        open={Boolean(message)}
        message={message ?? ""}
        variant={
          message ? competitionDetailMessageVariant(message) : "info"
        }
        title={
          message && competitionDetailMessageVariant(message) === "danger"
            ? "Couldn’t complete that"
            : message && competitionDetailMessageVariant(message) === "warning"
              ? "Sign in required"
              : message && competitionDetailMessageVariant(message) === "info"
                ? "Competition update"
                : undefined
        }
        onClose={() => setMessage(null)}
        autoCloseMs={
          message
            ? toastAutoCloseForVariant(
                competitionDetailMessageVariant(message),
              )
            : undefined
        }
      />
    </main>
  );
}
