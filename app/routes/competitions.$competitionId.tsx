import {
  Link,
  redirect,
  useLoaderData,
  useParams,
  useRevalidator,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { format } from "date-fns";
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
import { isCompetitionUuidParam } from "~/utils/competitionPath";
import { pubDetailPath } from "~/utils/pubPath";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";
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
  country_code?: string | null;
};

type ParticipantProfilePick = {
  nickname?: string | null;
  display_name?: string | null;
  country_code?: string | null;
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
  countryCode: string | null;
};

type RankedRow = {
  rank: number;
  userId: string;
  username: string;
  metric: string;
  detail: string;
  pourPath: string;
  countryCode: string | null;
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
    const cc = scoreRow.country_code?.trim().toUpperCase() ?? null;
    const pour: PourEntry = {
      value,
      at,
      scoreId: row.score_id,
      slug: scoreRow.slug ?? null,
      countryCode: cc && /^[A-Z]{2}$/.test(cc) ? cc : null,
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
          countryCode: linkPour.countryCode,
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
        countryCode: r.countryCode,
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
          countryCode: linkPour.countryCode,
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
        countryCode: r.countryCode,
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
        countryCode: linkPour.countryCode,
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
      countryCode: r.countryCode,
    }));
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const raw = (params.competitionId ?? "").trim();
  if (!raw) {
    throw new Response("Not found", { status: 404 });
  }

  const query = isCompetitionUuidParam(raw)
    ? supabase.from("competitions").select("*").eq("id", raw)
    : supabase.from("competitions").select("*").ilike("path_segment", raw);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      competitionId: "",
      competition: null as CompetitionRow | null,
      loadError: error.message,
    };
  }

  const row = (data ?? null) as CompetitionRow | null;
  if (!row) {
    throw new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const expectedTail = row.path_segment?.trim() || row.id;
  const currentTail = decodeURIComponent(
    url.pathname.replace(/^\/competitions\//i, "").replace(/\/+$/, ""),
  );
  if (currentTail !== expectedTail) {
    throw redirect(
      `/competitions/${encodeURIComponent(expectedTail)}${url.search}`,
    );
  }

  return {
    competitionId: row.id,
    competition: row,
    loadError: null as string | null,
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
  const [message, setMessage] = useState<string | null>(null);
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
  const [joinedBannerExpanded, setJoinedBannerExpanded] = useState(true);
  const [rightColTab, setRightColTab] = useState<"leaderboard" | "participants">(
    "leaderboard",
  );
  /** Mobile: summary card starts collapsed so the leaderboard is reachable without scrolling. */
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(`comp:joined-banner:${competitionId}`);
      setJoinedBannerExpanded(v !== "0");
    } catch {
      setJoinedBannerExpanded(true);
    }
  }, [competitionId]);

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
        .select("user_id, nickname, display_name, country_code")
        .in("user_id", partIds);
      const map: Record<string, ParticipantProfilePick> = {};
      for (const p of profs ?? []) {
        const u = p.user_id as string;
        const ccRaw = p.country_code != null ? String(p.country_code).trim() : "";
        map[u] = {
          nickname: p.nickname as string | null | undefined,
          display_name: p.display_name as string | null | undefined,
          country_code: ccRaw || null,
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
        "id, user_id, score_id, created_at, scores (id, slug, username, split_score, created_at, email, country_code)",
      )
      .eq("competition_id", id);

    const list = (csRows ?? []) as CompetitionScoreJoin[];
    setScoresJoined(list);
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
            className="mb-5 rounded-lg border border-[#312814] bg-guinness-black/30"
            role="status"
            aria-label="You are a participant in this competition"
          >
            <button
              type="button"
              aria-expanded={joinedBannerExpanded}
              onClick={() => {
                setJoinedBannerExpanded((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem(
                      `comp:joined-banner:${competitionId}`,
                      next ? "1" : "0",
                    );
                  } catch {
                    /* ignore */
                  }
                  return next;
                });
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-guinness-brown/20 sm:gap-3 sm:px-4 sm:py-3"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400/90"
                aria-hidden
              >
                ✓
              </span>
              <span className="min-w-0 flex-1 font-medium text-guinness-cream/95">
                You&apos;re in this competition
              </span>
              <span
                className={`shrink-0 text-xs text-guinness-tan/50 transition-transform duration-200 ${
                  joinedBannerExpanded ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ⌄
              </span>
            </button>
            {joinedBannerExpanded ? (
              <div className="border-t border-[#312814] px-3 pb-3 pt-0 sm:px-4 sm:pb-3.5">
                <p className="type-meta mt-4 pl-10 text-guinness-tan/75 sm:pl-11">
                  Log each pour with{" "}
                  <span className="text-guinness-cream/90">New pour for comp</span> while the
                  window is live — older scores can&apos;t be attached afterward. We&apos;ll
                  notify you when someone else submits.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <nav
          className="sticky top-2 z-20 mb-2 flex flex-wrap gap-2 rounded-xl border border-guinness-gold/15 bg-guinness-black/90 px-3 py-2.5 shadow-lg shadow-black/40 backdrop-blur-md lg:hidden"
          aria-label="Jump to section"
        >
          <a
            href="#comp-summary-section"
            onClick={(e) => {
              e.preventDefault();
              setMobileSummaryOpen(true);
              window.requestAnimationFrame(() => {
                document
                  .getElementById("comp-summary-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            className="rounded-lg bg-guinness-brown/50 px-3 py-1.5 text-xs font-semibold text-guinness-tan transition-colors hover:bg-guinness-brown/70"
          >
            Summary
          </a>
          <a
            href="#comp-leaderboard-panel"
            className="rounded-lg bg-guinness-gold/20 px-3 py-1.5 text-xs font-semibold text-guinness-gold transition-colors hover:bg-guinness-gold/30"
          >
            Leaderboard
          </a>
          <button
            type="button"
            onClick={() => {
              setRightColTab("participants");
              window.requestAnimationFrame(() => {
                document
                  .getElementById("comp-leaderboard-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            className="rounded-lg bg-guinness-brown/50 px-3 py-1.5 text-xs font-semibold text-guinness-tan transition-colors hover:bg-guinness-brown/70"
          >
            Who&apos;s in
          </button>
        </nav>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-10">
        <section
          id="comp-summary-section"
          className="order-1 scroll-mt-28 lg:col-start-1 lg:row-start-1"
          aria-labelledby="comp-overview-heading"
        >
          <h2
            id="comp-overview-heading"
            className="type-card-title mb-3 hidden lg:block"
          >
            Summary
          </h2>
          <button
            type="button"
            aria-expanded={mobileSummaryOpen}
            aria-controls="comp-summary-body"
            onClick={() => setMobileSummaryOpen((o) => !o)}
            className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[#312814] bg-guinness-brown/25 px-3 py-2.5 text-left transition-colors hover:bg-guinness-brown/35 lg:hidden"
          >
            <div className="min-w-0">
              <p className="text-base font-semibold text-guinness-gold">Summary</p>
              <p className="type-meta mt-0.5 truncate text-guinness-tan/70">
                {timePhase?.phase === "before"
                  ? `Upcoming · starts in ${timePhase ? formatDuration(timePhase.ms) : "—"}`
                  : timePhase?.phase === "live"
                    ? `Live · ends in ${timePhase ? formatDuration(timePhase.ms) : "—"}`
                    : "Ended"}
                <span className="text-guinness-tan/45"> · </span>
                {participantUserIds.length}/{competition.max_participants} in
              </p>
            </div>
            <span
              className={`shrink-0 text-guinness-tan/50 transition-transform duration-200 ${
                mobileSummaryOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            >
              ⌄
            </span>
          </button>
          <div
            id="comp-summary-body"
            className={`rounded-2xl border border-guinness-gold/15 bg-guinness-brown/25 p-4 sm:p-5 ${
              mobileSummaryOpen ? "max-lg:block" : "max-lg:hidden"
            } lg:block`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-guinness-gold/10 pb-4">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  timePhase?.phase === "live"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : timePhase?.phase === "before"
                      ? "bg-guinness-gold/15 text-guinness-gold"
                      : "bg-guinness-black/50 text-guinness-tan/75"
                }`}
              >
                {timePhase?.phase === "before"
                  ? "Upcoming"
                  : timePhase?.phase === "live"
                    ? "Live"
                    : "Ended"}
              </span>
              <span className="text-guinness-tan/40" aria-hidden>
                ·
              </span>
              <span className="text-sm text-guinness-tan/80">
                {isPrivate ? "Private" : "Public"}
              </span>
              <span className="text-guinness-tan/40" aria-hidden>
                ·
              </span>
              <span className="text-sm font-medium text-guinness-gold">
                {winRuleLabel(competition.win_rule)}
                {competition.win_rule === "closest_to_target" &&
                competition.target_score != null
                  ? ` · target ${Number(competition.target_score).toFixed(2)}`
                  : ""}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-5">
              <div className="rounded-xl border border-[#312814] bg-[#312814]/40 px-4 py-4">
                <p className="type-meta text-guinness-tan/55">
                  {timePhase?.phase === "before"
                    ? "Starts in"
                    : timePhase?.phase === "live"
                      ? "Ends in"
                      : "Window"}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums leading-tight text-guinness-cream sm:text-[1.65rem]">
                  {timePhase?.phase === "after"
                    ? "—"
                    : timePhase
                      ? formatDuration(timePhase.ms)
                      : "—"}
                </p>
              </div>
              <div>
                <p className="type-meta text-guinness-tan/55">Schedule</p>
                <p className="mt-2 text-sm leading-relaxed text-guinness-cream">
                  {format(new Date(competition.starts_at), "EEE MMM d, h:mm a")}
                  <span className="text-guinness-tan/45"> → </span>
                  {format(new Date(competition.ends_at), "EEE MMM d, h:mm a")}
                </p>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-[#312814] bg-[#312814]/25 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div>
                  <p className="type-meta text-guinness-tan/55">Roster</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-guinness-cream">
                    {participantUserIds.length}/{competition.max_participants}
                  </p>
                </div>
                <div className="sm:min-w-[8rem] sm:text-right">
                  <p className="type-meta text-guinness-tan/55">Pour limit</p>
                  <p className="mt-2 text-base font-medium text-guinness-tan/90">
                    {competition.glasses_per_person} pour
                    {competition.glasses_per_person === 1 ? "" : "s"} each
                  </p>
                </div>
              </div>
            </div>

            {competition.linked_bar_key?.trim() ||
            competition.location_name?.trim() ||
            competition.location_address?.trim() ? (
              <div className="mt-4 space-y-2 border-t border-guinness-gold/10 pt-4 text-sm leading-relaxed">
                {competition.linked_bar_key?.trim() ? (
                  <p className="text-guinness-tan/85">
                    <span className="text-guinness-tan/50">Directory · </span>
                    <Link
                      to={pubDetailPath(competition.linked_bar_key.trim())}
                      viewTransition
                      className="font-medium text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 hover:decoration-guinness-gold"
                    >
                      Open pub page
                    </Link>
                  </p>
                ) : null}
                {competition.location_name?.trim() ||
                competition.location_address?.trim() ? (
                  <p className="text-guinness-cream">
                    <span className="text-guinness-tan/50">Venue · </span>
                    {competition.location_name?.trim() ? (
                      <span className="font-medium text-guinness-gold">
                        {competition.location_name.trim()}
                      </span>
                    ) : null}
                    {competition.location_name?.trim() &&
                    competition.location_address?.trim() ? (
                      <span className="text-guinness-tan/75">
                        {" "}
                        — {competition.location_address.trim()}
                      </span>
                    ) : competition.location_address?.trim() &&
                      !competition.location_name?.trim() ? (
                      <span>{competition.location_address.trim()}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className="mt-6 flex flex-col gap-5 border-t border-[#312814] pt-6"
              aria-label="Competition actions"
            >
              {!userId ? (
                <p className="type-meta text-guinness-tan/70">
                  Sign in (Profile) to join or pour for this competition.
                </p>
              ) : joined ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    {canSubmit ? (
                      <Link
                        to={`/?competition=${encodeURIComponent(competitionId)}`}
                        viewTransition
                        className={`${pageHeaderActionButtonClass} w-full`}
                      >
                        New pour for comp
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleLeave()}
                      className="w-full rounded-lg border border-[#312814] bg-transparent px-4 py-2.5 text-sm font-medium text-guinness-tan/90 transition-colors hover:bg-[#312814]/30"
                    >
                      Leave competition
                    </button>
                  </div>
                  {canSubmit ? (
                    <details className="type-meta rounded-lg border border-[#312814] bg-guinness-black/20 px-3 py-2.5 text-guinness-tan/60">
                      <summary className="cursor-pointer select-none text-sm font-medium text-guinness-tan/75 hover:text-guinness-tan">
                        How pours count
                      </summary>
                      <p className="mt-3 border-t border-[#312814] pt-3 text-guinness-tan/55">
                        Only new pours you log from the pour screen with this competition
                        selected count — you can&apos;t attach older pours after joining.
                      </p>
                    </details>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleJoin()}
                  className={`${pageHeaderActionButtonClass} w-full`}
                >
                  Join competition
                </button>
              )}
            </div>
          </div>
        </section>

        <section
          id="comp-leaderboard-panel"
          className="order-2 scroll-mt-28 lg:col-start-2 lg:row-start-1 lg:max-h-[min(72vh,calc(100vh-5.5rem))] lg:min-w-0 lg:overflow-y-auto lg:self-start lg:pt-0 xl:max-h-[calc(100vh-6rem)]"
          aria-label="Competition leaderboard and roster"
        >
          <div
            className="mb-4 flex gap-1 rounded-xl border border-[#312814] bg-guinness-black/20 p-1"
            role="tablist"
            aria-label="Leaderboard and roster"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rightColTab === "leaderboard"}
              id="tab-comp-leaderboard"
              aria-controls="panel-comp-leaderboard"
              onClick={() => setRightColTab("leaderboard")}
              className={`min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                rightColTab === "leaderboard"
                  ? "bg-guinness-gold/25 text-guinness-gold shadow-sm shadow-black/20"
                  : "text-guinness-tan/70 hover:bg-guinness-brown/40 hover:text-guinness-tan"
              }`}
            >
              Leaderboard
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightColTab === "participants"}
              id="tab-comp-participants"
              aria-controls="panel-comp-participants"
              onClick={() => setRightColTab("participants")}
              className={`min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                rightColTab === "participants"
                  ? "bg-guinness-gold/25 text-guinness-gold shadow-sm shadow-black/20"
                  : "text-guinness-tan/70 hover:bg-guinness-brown/40 hover:text-guinness-tan"
              }`}
            >
              Who&apos;s in
            </button>
          </div>

          <div
            id="panel-comp-leaderboard"
            role="tabpanel"
            aria-labelledby="tab-comp-leaderboard"
            hidden={rightColTab !== "leaderboard"}
          >
            {ranked.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#312814] bg-guinness-black/20 px-4 py-8 text-center">
                <p className="type-meta text-guinness-tan/55">
                  Waiting for the first pour.
                </p>
                <p className="type-meta mt-2 text-guinness-tan/45">
                  Scores show up when someone uses{" "}
                  <span className="text-guinness-tan/65">New pour for comp</span> during the
                  live window.
                </p>
              </div>
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
                            {flagEmojiFromIso2(
                              r.countryCode ?? participantProfiles[r.userId]?.country_code,
                            ) ? (
                              <span
                                className="mr-1 inline-block shrink-0"
                                title={
                                  (
                                    r.countryCode ??
                                    participantProfiles[r.userId]?.country_code
                                  )
                                    ?.trim()
                                    .toUpperCase() ?? undefined
                                }
                                aria-hidden
                              >
                                {flagEmojiFromIso2(
                                  r.countryCode ??
                                    participantProfiles[r.userId]?.country_code,
                                )}
                              </span>
                            ) : null}
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
          </div>

          <div
            id="panel-comp-participants"
            role="tabpanel"
            aria-labelledby="tab-comp-participants"
            hidden={rightColTab !== "participants"}
          >
            <h3 className="sr-only">Who&apos;s in</h3>
            <p className="type-meta mb-4 text-guinness-tan/70">
              {userId
                ? "Everyone who joined. After someone pours in this comp, you can add them as a friend if their email appears on their pour."
                : "Sign in to see friend actions. Participant count is in the summary."}
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
                        {flagEmojiFromIso2(participantProfiles[pid]?.country_code) ? (
                          <span
                            className="mr-1 inline-block shrink-0"
                            title={
                              participantProfiles[pid]?.country_code
                                ?.trim()
                                .toUpperCase() ?? undefined
                            }
                            aria-hidden
                          >
                            {flagEmojiFromIso2(participantProfiles[pid]?.country_code)}
                          </span>
                        ) : null}
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
          </div>
        </section>
        </div>
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
