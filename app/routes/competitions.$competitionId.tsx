import {
  Link,
  useLoaderData,
  useParams,
} from "react-router";
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
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { pubDetailPath } from "~/utils/pubPath";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";
import { SegmentedTabs } from "~/components/ui/segmented-tabs";
import {
  buildLeaderboard,
  COMPETITION_SCORE_LIMIT,
  COMPETITION_SCORES_SELECT,
  unwrapScore,
  type CompetitionScoreJoin,
} from "~/utils/competitionLeaderboard";
import type { CompetitionRow } from "./competitions.shared";
import type { loader as competitionDetailLoader } from "./competitions.$competitionId.loader";
import {
  CrownIcon,
  CompetitionLeaderboardScoreAside,
  competitionLeaderboardSecondaryMeta,
  formatDuration,
  normalizeEmail,
  type ParticipantProfilePick,
  type WinRule,
  winRuleLabel,
} from "./competitions.$competitionId.shared";

export { loader } from "./competitions.$competitionId.loader";

export default function CompetitionDetail() {
  const { competitionId, competition: loaderComp, loadError } =
    useLoaderData<typeof competitionDetailLoader>();
  const params = useParams();

  const [competition, setCompetition] = useState<CompetitionRow | null>(
    loaderComp,
  );
  const [joined, setJoined] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [scoresJoined, setScoresJoined] = useState<CompetitionScoreJoin[]>([]);
  const [scoresLimited, setScoresLimited] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
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
    const t = setInterval(() => setNowMs(Date.now()), 30000);
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
    const supabase = await getSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const em = auth.user?.email?.trim() ?? null;
    const emNorm = em ? normalizeEmail(em) : null;
    setUserId(uid);
    setUserEmail(em);

    const [{ data: allParts }, { data: csRows }] = await Promise.all([
      supabase
        .from("competition_participants")
        .select("user_id")
        .eq("competition_id", id),
      supabase
        .from("competition_scores")
        .select(COMPETITION_SCORES_SELECT)
        .eq("competition_id", id)
        .order("created_at", { ascending: false })
        .limit(COMPETITION_SCORE_LIMIT),
    ]);
    const partIds = [
      ...new Set(
        (allParts ?? [])
          .map((r) => r.user_id as string | null)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    setParticipantUserIds(partIds);
    setJoined(uid ? partIds.includes(uid) : false);

    const profilesPromise = partIds.length
      ? supabase
          .from("public_profiles")
          .select("user_id, nickname, display_name, country_code")
          .in("user_id", partIds)
      : Promise.resolve({ data: null } as { data: null });
    const friendsPromise =
      uid && emNorm
        ? Promise.all([
            supabase
              .from("user_friends")
              .select("user_id, friend_user_id")
              .or(`user_id.eq.${uid},friend_user_id.eq.${uid}`),
            supabase
              .from("friend_requests")
              .select("to_email")
              .eq("from_user_id", uid)
              .eq("status", "pending"),
          ])
        : Promise.resolve(null);

    const [profilesRes, friendsRes] = await Promise.all([
      profilesPromise,
      friendsPromise,
    ]);
    if (profilesRes.data) {
      const map: Record<string, ParticipantProfilePick> = {};
      for (const p of profilesRes.data) {
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

    if (friendsRes) {
      const [friendsResult, outReqResult] = friendsRes;
      const fr = friendsResult.data;
      const outReq = outReqResult.data;
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

    const list = (csRows ?? []) as CompetitionScoreJoin[];
    setScoresJoined(list);
    setScoresLimited(list.length >= COMPETITION_SCORE_LIMIT);
  }, [competitionId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

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
      const supabase = await getSupabaseBrowserClient();
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
    const now = nowMs;
    const start = new Date(competition.starts_at).getTime();
    const end = new Date(competition.ends_at).getTime();
    if (now < start) return { phase: "before" as const, ms: start - now };
    if (now > end) return { phase: "after" as const, ms: 0 };
    return { phase: "live" as const, ms: end - now };
  }, [competition, nowMs]);

  async function handleJoin() {
    setMessage(null);
    const supabase = await getSupabaseBrowserClient();
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
      void refreshAll();
      setMessage("You’re in! Welcome to the competition.");
    }
  }

  async function handleLeave() {
    setMessage(null);
    const supabase = await getSupabaseBrowserClient();
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
            className={`mb-5 rounded-lg border bg-guinness-black/30 ${
              timePhase?.phase === "after"
                ? "border-amber-500/25 bg-amber-950/15"
                : "border-[#312814]"
            }`}
            role="status"
            aria-label={
              timePhase?.phase === "after"
                ? "You participated in this competition; it has ended"
                : "You are a participant in this competition"
            }
          >
            <button
              type="button"
              aria-expanded={joinedBannerExpanded ? "true" : "false"}
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
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors sm:gap-3 sm:px-4 sm:py-3 ${
                timePhase?.phase === "after"
                  ? "hover:bg-amber-950/25"
                  : "hover:bg-guinness-brown/20"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  timePhase?.phase === "after"
                    ? "bg-amber-500/20 text-amber-200/95"
                    : "bg-emerald-500/15 text-emerald-400/90"
                }`}
                aria-hidden
              >
                ✓
              </span>
              <span className="min-w-0 flex-1 font-medium text-guinness-cream/95">
                {timePhase?.phase === "after"
                  ? "You took part in this competition"
                  : "You&apos;re in this competition"}
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
              <div
                className={`border-t px-3 pb-3 pt-0 sm:px-4 sm:pb-3.5 ${
                  timePhase?.phase === "after"
                    ? "border-amber-500/20"
                    : "border-[#312814]"
                }`}
              >
                <p className="type-meta mt-4 pl-10 text-guinness-tan/75 sm:pl-11">
                  {timePhase?.phase === "after" ? (
                    <>
                      The competition window has closed. Pours had to be logged with{" "}
                      <span className="text-guinness-cream/90">New pour for comp</span> while
                      it was live; older scores couldn&apos;t be attached afterward. Thanks
                      for playing.
                    </>
                  ) : (
                    <>
                      Log each pour with{" "}
                      <span className="text-guinness-cream/90">New pour for comp</span> while the
                      window is live; older scores can&apos;t be attached afterward. We&apos;ll
                      notify you when someone else submits.
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <SegmentedTabs
          className="sticky top-2 z-20 mb-2 w-full shadow-lg shadow-black/40 backdrop-blur-md lg:hidden"
          layoutClassName="flex w-full"
          variant="rowEqual"
          aria-label="Jump to section"
          value={
            mobileSummaryOpen
              ? "summary"
              : rightColTab === "leaderboard"
                ? "leaderboard"
                : "participants"
          }
          onValueChange={(v) => {
            if (v === "summary") {
              setMobileSummaryOpen(true);
              window.requestAnimationFrame(() => {
                document
                  .getElementById("comp-summary-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
              return;
            }
            setMobileSummaryOpen(false);
            setRightColTab(v === "leaderboard" ? "leaderboard" : "participants");
            window.requestAnimationFrame(() => {
              document
                .getElementById("comp-leaderboard-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
          items={[
            { value: "summary", label: "Summary" },
            { value: "leaderboard", label: "Leaderboard" },
            { value: "participants", label: "Who's in" },
          ]}
        />

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
            aria-expanded={mobileSummaryOpen ? "true" : "false"}
            aria-controls="comp-summary-body"
            onClick={() => setMobileSummaryOpen((o) => !o)}
            className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[#312814] bg-guinness-brown/25 px-3 py-2.5 text-left transition-colors hover:bg-guinness-brown/35 lg:hidden"
          >
            <div className="min-w-0">
              <p className="text-base font-semibold text-guinness-gold">Summary</p>
              <p className="type-meta mt-0.5 truncate text-guinness-tan/70">
                {timePhase?.phase === "before"
                  ? `Upcoming · starts in ${timePhase ? formatDuration(timePhase.ms) : "…"}`
                  : timePhase?.phase === "live"
                    ? `Live · ends in ${timePhase ? formatDuration(timePhase.ms) : "…"}`
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
                    ? "Ended"
                    : timePhase
                      ? formatDuration(timePhase.ms)
                      : "…"}
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
                        · {competition.location_address.trim()}
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
                        selected count; you can&apos;t attach older pours after joining.
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
          <SegmentedTabs
            className="mb-4 hidden w-full lg:mb-6 lg:flex"
            layoutClassName="flex w-full"
            variant="rowEqual"
            role="tablist"
            aria-label="Leaderboard and roster"
            tabIdPrefix="tab-comp"
            value={rightColTab}
            onValueChange={(v) =>
              setRightColTab(v === "participants" ? "participants" : "leaderboard")
            }
            items={[
              {
                value: "leaderboard",
                label: "Leaderboard",
                panelId: "panel-comp-leaderboard",
              },
              {
                value: "participants",
                label: "Who's in",
                panelId: "panel-comp-participants",
              },
            ]}
          />

          <div
            id="panel-comp-leaderboard"
            role="tabpanel"
            aria-labelledby="tab-comp-leaderboard"
            hidden={rightColTab !== "leaderboard"}
          >
            {scoresLimited ? (
              <p className="type-meta mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100/90">
                Showing the most recent {COMPETITION_SCORE_LIMIT} competition
                pours for leaderboard performance.
              </p>
            ) : null}
            {ranked.length === 0 ? (
              <p className="type-meta rounded-2xl border border-[#322914] bg-guinness-brown/30 p-8 text-center text-guinness-tan/70">
                {timePhase?.phase === "after" ? (
                  <>
                    No pours were logged for this competition during the live window, so there is
                    no leaderboard.
                  </>
                ) : (
                  <>
                    Waiting for the first pour. Scores appear when someone uses{" "}
                    <span className="text-guinness-tan/85">New pour for comp</span> during the live
                    window.
                  </>
                )}
              </p>
            ) : (
              <ul className="w-full">
                {ranked.map((r) => {
                  const friendSlot = friendActionForPeer(r.userId);
                  const cc =
                    r.countryCode ?? participantProfiles[r.userId]?.country_code;
                  const winRule = competition.win_rule as WinRule;
                  const secondary = competitionLeaderboardSecondaryMeta(r, winRule);
                  const isEndedWinner =
                    timePhase?.phase === "after" && r.rank === 1;
                  return (
                    <li key={r.userId} className="mb-4 last:mb-0">
                      <div
                        className={`flex flex-col overflow-hidden rounded-2xl border bg-guinness-brown/35 transition-colors sm:flex-row sm:items-stretch ${
                          isEndedWinner
                            ? "border-guinness-gold/45 shadow-md shadow-amber-900/20 hover:border-guinness-gold/55 hover:bg-guinness-brown/50"
                            : "border-[#322914] hover:border-guinness-gold/30 hover:bg-guinness-brown/50"
                        }`}
                      >
                        <Link
                          to={r.pourPath}
                          viewTransition
                          className="flex min-w-0 flex-1 items-center gap-3 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinness-gold sm:gap-5 sm:p-5"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-guinness-gold/12 text-xl font-bold text-guinness-gold sm:h-14 sm:w-14 sm:text-2xl">
                            #{r.rank}
                          </div>
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-guinness-black/50 sm:h-20 sm:w-20">
                            {r.splitImageUrl ? (
                              <img
                                src={r.splitImageUrl}
                                alt={`Split by ${r.username}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                {isEndedWinner ? (
                                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-guinness-gold/40 bg-guinness-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-guinness-gold">
                                      <CrownIcon className="text-guinness-gold" />
                                      Winner
                                    </span>
                                  </div>
                                ) : null}
                                <p className="truncate text-lg font-semibold text-guinness-cream sm:text-2xl">
                                  {flagEmojiFromIso2(cc) ? (
                                    <span
                                      className="mr-1.5 inline-block shrink-0"
                                      title={cc?.trim().toUpperCase() ?? undefined}
                                      aria-hidden
                                    >
                                      {flagEmojiFromIso2(cc)}
                                    </span>
                                  ) : null}
                                  {r.username}
                                </p>
                                <p className="type-meta text-guinness-tan/70">
                                  {new Date(
                                    r.representativeCreatedAt,
                                  ).toLocaleDateString()}
                                </p>
                                {secondary ? (
                                  <p className="type-meta mt-0.5 text-guinness-tan/60">
                                    {secondary}
                                  </p>
                                ) : null}
                              </div>
                              <CompetitionLeaderboardScoreAside row={r} winRule={winRule} />
                            </div>
                          </div>
                        </Link>
                        {friendSlot ? (
                          <div className="flex min-w-0 shrink-0 flex-col justify-center border-t border-[#322914] px-4 py-3 sm:max-w-[12rem] sm:border-l sm:border-t-0 sm:px-4">
                            {friendSlot}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
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
                No participants yet. Be the first to join.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedParticipantUserIds.map((pid) => (
                  <li
                    key={pid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#201B10] bg-guinness-brown/20 px-4 py-3"
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
