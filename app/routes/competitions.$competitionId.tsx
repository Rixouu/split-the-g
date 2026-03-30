import { ChevronDown } from "lucide-react";
import { Link, useLoaderData, useParams } from "react-router";
import { useCompetitionRouteResolution } from "~/components/competition/hooks/useCompetitionRouteResolution";
import { AppLink } from "~/i18n/app-link";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageHeaderSecondaryActionButtonClass,
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
import { useI18n } from "~/i18n/context";
import { localizePath } from "~/i18n/paths";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import {
  buildLeaderboard,
  COMPETITION_SCORE_LIMIT,
  COMPETITION_SCORES_SELECT,
  unwrapScore,
  type CompetitionScoreJoin,
} from "~/utils/competitionLeaderboard";
import {
  competitionCardDividerClass,
  competitionCardFrameClass,
  competitionCardTopLightClass,
  competitionStatCellClass,
  isStoredGlassesUnlimited,
  winRuleUsesUnlimitedGlasses,
  type CompetitionRow,
} from "./competitions.shared";
import type { loader as competitionDetailLoader } from "./competitions.$competitionId.loader";
import {
  CrownIcon,
  CompetitionLeaderboardScoreAside,
  competitionLeaderboardSecondaryMeta,
  formatDuration,
  normalizeEmail,
  type ParticipantProfilePick,
  type WinRule,
} from "./competitions.$competitionId.shared";

export { loader } from "./competitions.$competitionId.loader";

export function meta({
  params,
}: {
  params: { competitionId?: string; lang?: string };
}) {
  const competitionId = params.competitionId?.trim();
  return seoMetaForRoute(
    params,
    competitionId
      ? `/competitions/${encodeURIComponent(competitionId)}`
      : "/competitions",
    "competitionDetail",
  );
}

export default function CompetitionDetail() {
  const { t, lang } = useI18n();
  const { competition: loaderComp, loadError } =
    useLoaderData<typeof competitionDetailLoader>();
  const params = useParams();
  const {
    competition,
    pending: clientResolvePending,
    notFound: clientNotFound,
    resolveError,
    effectiveId,
  } = useCompetitionRouteResolution(loaderComp, params.competitionId);

  function winRuleLabelI18n(rule: string): string {
    switch (rule) {
      case "closest_to_target":
        return t("pages.competitions.winRuleOptionClosest");
      case "most_submissions":
        return t("pages.competitions.winRuleOptionMost");
      case "lowest_score":
        return t("pages.competitions.winRuleOptionLowest");
      case "best_average":
        return t("pages.competitions.winRuleOptionBestAverage");
      default:
        return t("pages.competitions.winRuleOptionHighest");
    }
  }

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
  /** Small viewports: summary starts collapsed so leaderboard tabs stay reachable with less scroll. */
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!effectiveId) return;
    try {
      const v = localStorage.getItem(`comp:joined-banner:${effectiveId}`);
      setJoinedBannerExpanded(v !== "0");
    } catch {
      setJoinedBannerExpanded(true);
    }
  }, [effectiveId]);

  const refreshAll = useCallback(async () => {
    const id = effectiveId;
    if (!id) return;
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
  }, [effectiveId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

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
        t("pages.competitionDetail.defaultPlayer")
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
  }, [
    participantUserIds,
    participantProfiles,
    rankedUsernameByUserId,
    userId,
    t,
  ]);

  const sendFriendInviteToPeer = useCallback(
    async (toEmail: string, peerUserId: string) => {
      const supabase = await getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user;
      if (!me?.id || !me.email) {
        setMessage(t("pages.competitionDetail.msgSignInAddFriends"));
        return;
      }
      const to = normalizeEmail(toEmail);
      if (!to.includes("@")) {
        setMessage(t("pages.competitionDetail.msgNoEmailForPlayer"));
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
          setMessage(
            alreadyPending
              ? t("pages.profile.msgFriendPendingResent")
              : t("pages.profile.msgFriendRequestSent"),
          );
        }
      } finally {
        setFriendInviteBusy(null);
      }
    },
    [pendingFriendEmails, t],
  );

  const participantLabel = useCallback(
    (uid: string) => {
      const p = participantProfiles[uid];
      return (
        p?.nickname?.trim() ||
        p?.display_name?.trim() ||
        rankedUsernameByUserId.get(uid) ||
        t("pages.competitionDetail.defaultPlayer")
      );
    },
    [participantProfiles, rankedUsernameByUserId, t],
  );

  const friendActionForPeer = useCallback(
    (peerUserId: string): ReactNode => {
      if (!userId || peerUserId === userId) return null;
      if (friendPeerIds.has(peerUserId)) {
        return (
          <span className="type-meta text-xs text-emerald-400/90">
            {t("pages.competitionDetail.friendsLabel")}
          </span>
        );
      }
      const claimEmail = emailByUserId.get(peerUserId) ?? null;
      if (!claimEmail) {
        return (
          <span className="type-meta max-w-[11rem] text-right text-xs leading-snug text-guinness-tan/50">
            {t("pages.competitionDetail.emailAfterPour")}
          </span>
        );
      }
      const norm = normalizeEmail(claimEmail);
      if (userEmail && norm === normalizeEmail(userEmail)) return null;
      if (pendingFriendEmails.has(norm)) {
        return (
          <span className="type-meta text-xs text-guinness-tan/60">
            {t("pages.competitionDetail.requestPending")}
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
          {friendInviteBusy === peerUserId
            ? t("pages.competitionDetail.addFriendBusy")
            : t("pages.competitionDetail.addFriend")}
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
      t,
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
      setMessage(t("pages.competitionDetail.msgSignInToJoin"));
      return;
    }
    const { error } = await supabase.from("competition_participants").insert({
      competition_id: effectiveId,
      user_id: u.user.id,
    });
    if (error) setMessage(error.message);
    else {
      setJoined(true);
      void refreshAll();
      setMessage(t("pages.competitionDetail.msgWelcomeJoin"));
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
      .eq("competition_id", effectiveId)
      .eq("user_id", u.user.id);
    if (error) setMessage(error.message);
    else {
      setJoined(false);
      void refreshAll();
      setMessage(t("pages.competitionDetail.msgLeftComp"));
    }
  }

  if (!params.competitionId) {
    return null;
  }

  const combinedLoadError = loadError ?? resolveError;

  if (combinedLoadError && !competition && !clientResolvePending) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-red-400/90">{combinedLoadError}</p>
          <AppLink
            to="/competitions"
            viewTransition
            className="mt-4 inline-block text-guinness-gold underline"
          >
            {t("pages.competitionDetail.backToListError")}
          </AppLink>
        </div>
      </main>
    );
  }

  if (clientNotFound && !clientResolvePending) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-guinness-tan/80">
            {t("pages.competitionDetail.competitionNotFound")}
          </p>
          <AppLink
            to="/competitions"
            viewTransition
            className="mt-4 inline-block text-guinness-gold underline"
          >
            {t("pages.competitionDetail.backToListError")}
          </AppLink>
        </div>
      </main>
    );
  }

  if (!competition) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-guinness-tan/70">
            {t("pages.competitionDetail.loadingCompetition")}
          </p>
        </div>
      </main>
    );
  }

  const isPrivate = (competition.visibility ?? "public") === "private";
  const canSubmit =
    joined &&
    timePhase?.phase === "live" &&
    userId;
  const rosterFull =
    participantUserIds.length >= competition.max_participants;
  const canJoinCompetition =
    Boolean(userId) &&
    !joined &&
    timePhase?.phase !== "after" &&
    !rosterFull;
  /** Join lives in PageHeader on md+; hide empty action strip above tabs. */
  const hideSummaryJoinStripOnMd = canJoinCompetition;

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={competition.title}
          description={t("pages.descriptions.competitionDetail")}
        >
          <AppLink
            to="/competitions"
            viewTransition
            className={pageHeaderActionButtonClass}
          >
            {t("pages.competitionDetail.backToList")}
          </AppLink>
          {canJoinCompetition ? (
            <button
              type="button"
              onClick={() => void handleJoin()}
              className={`${pageHeaderSecondaryActionButtonClass} hidden md:inline-flex`}
            >
              {t("pages.competitionDetail.joinCompetition")}
            </button>
          ) : null}
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
                ? t("pages.competitionDetail.ariaJoinedEnded")
                : t("pages.competitionDetail.ariaJoinedLive")
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
                      `comp:joined-banner:${competition.id}`,
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
                  ? t("pages.competitionDetail.bannerTitleEnded")
                  : t("pages.competitionDetail.bannerTitleLive")}
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
                      {t("pages.competitionDetail.bannerBodyEndedBefore")}{" "}
                      <span className="text-guinness-cream/90">
                        {t("pages.competitionDetail.newPourForComp")}
                      </span>{" "}
                      {t("pages.competitionDetail.bannerBodyEndedAfter")}
                    </>
                  ) : (
                    <>
                      {t("pages.competitionDetail.bannerBodyLiveBefore")}{" "}
                      <span className="text-guinness-cream/90">
                        {t("pages.competitionDetail.newPourForComp")}
                      </span>{" "}
                      {t("pages.competitionDetail.bannerBodyLiveMiddle")}
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <section
          id="comp-summary-section"
          className="order-1 scroll-mt-28"
          aria-labelledby="comp-overview-heading"
        >
          <h2
            id="comp-overview-heading"
            className="type-card-title mb-3 hidden md:block"
          >
            {t("pages.competitionDetail.tabSummary")}
          </h2>
          <button
            type="button"
            aria-expanded={mobileSummaryOpen ? "true" : "false"}
            aria-controls="comp-summary-body"
            onClick={() => setMobileSummaryOpen((o) => !o)}
            className={`group mb-3 relative flex w-full overflow-hidden text-left transition-all active:scale-[0.995] md:hidden ${competitionCardFrameClass}`}
          >
            <div className={competitionCardTopLightClass} aria-hidden />
            <div className="relative z-0 flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-guinness-gold/75">
                  {t("pages.competitionDetail.summaryOverview")}
                </p>
                <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-guinness-cream/95">
                  {timePhase?.phase === "before"
                    ? t("pages.competitionDetail.summaryLineUpcoming", {
                        duration: timePhase
                          ? formatDuration(timePhase.ms)
                          : "…",
                      })
                    : timePhase?.phase === "live"
                      ? t("pages.competitionDetail.summaryLineLive", {
                          duration: timePhase
                            ? formatDuration(timePhase.ms)
                            : "…",
                        })
                      : t("pages.competitionDetail.summaryLineEnded")}
                  <span className="text-guinness-tan/45"> · </span>
                  {t("pages.competitionDetail.summaryParticipantsIn", {
                    current: String(participantUserIds.length),
                    max: String(competition.max_participants),
                  })}
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-guinness-gold/70 transition-transform duration-200 group-hover:text-guinness-gold ${
                  mobileSummaryOpen ? "rotate-180" : ""
                }`}
                aria-hidden
                strokeWidth={2.25}
              />
            </div>
          </button>
          <div
            id="comp-summary-body"
            className={`relative overflow-hidden ${competitionCardFrameClass} ${
              mobileSummaryOpen ? "max-md:block" : "max-md:hidden"
            } md:block`}
          >
            <div className={competitionCardTopLightClass} aria-hidden />
            <div className="relative z-0 flex flex-col gap-4 px-3.5 pb-4 pt-6 sm:gap-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    timePhase?.phase === "live"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : timePhase?.phase === "before"
                        ? "bg-guinness-gold/15 text-guinness-gold"
                        : "bg-guinness-black/50 text-guinness-tan/75"
                  }`}
                >
                  {timePhase?.phase === "before"
                    ? t("pages.competitionDetail.upcoming")
                    : timePhase?.phase === "live"
                      ? t("pages.competitionDetail.live")
                      : t("pages.competitionDetail.ended")}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isPrivate
                      ? "border border-solid border-guinness-frame bg-guinness-black/55 text-guinness-tan/90"
                      : "bg-guinness-gold text-guinness-black shadow-sm shadow-black/20"
                  }`}
                >
                  {isPrivate
                    ? t("pages.competitions.badgePrivate")
                    : t("pages.competitions.badgePublic")}
                </span>
              </div>

              <div>
                <p className="text-[11px] leading-relaxed text-guinness-tan/50 sm:text-xs sm:text-guinness-tan/55">
                  {new Date(competition.starts_at).toLocaleString()} →{" "}
                  {new Date(competition.ends_at).toLocaleString()}
                </p>
                <p className="mt-1 text-xs leading-snug text-guinness-cream/90 sm:text-sm">
                  {format(new Date(competition.starts_at), "EEE MMM d, h:mm a")}
                  <span className="text-guinness-tan/40"> → </span>
                  {format(new Date(competition.ends_at), "EEE MMM d, h:mm a")}
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-guinness-gold sm:text-base">
                  {timePhase?.phase === "after"
                    ? t("pages.competitionDetail.ended")
                    : timePhase
                      ? formatDuration(timePhase.ms)
                      : "…"}
                </p>
                <p className="type-meta mt-1 text-[11px] text-guinness-tan/45 sm:text-xs">
                  {timePhase?.phase === "before"
                    ? t("pages.competitionDetail.startsIn")
                    : timePhase?.phase === "live"
                      ? t("pages.competitionDetail.endsIn")
                      : t("pages.competitionDetail.window")}
                </p>
              </div>

              <div
                className={`grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-3 sm:pt-4 ${competitionCardDividerClass}`}
              >
                <div className={`${competitionStatCellClass} col-span-1`}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-guinness-gold/65">
                    {t("pages.competitions.statJoined")}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold tabular-nums text-guinness-gold sm:text-base">
                    {participantUserIds.length}
                    <span className="text-guinness-tan/45"> / </span>
                    {competition.max_participants}
                  </span>
                </div>
                <div className={`${competitionStatCellClass} col-span-1`}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-guinness-gold/65">
                    {t("pages.competitions.statGlassesEach")}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold text-guinness-cream sm:text-base">
                    {winRuleUsesUnlimitedGlasses(competition.win_rule) ||
                    isStoredGlassesUnlimited(competition.glasses_per_person)
                      ? t("pages.competitions.glassesPerPersonUnlimited")
                      : competition.glasses_per_person}
                  </span>
                </div>
                <div
                  className={`${competitionStatCellClass} col-span-2 sm:col-span-1`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-guinness-gold/65">
                    {t("pages.competitions.statRule")}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold leading-snug text-guinness-cream">
                    {winRuleLabelI18n(competition.win_rule)}
                    {competition.win_rule === "closest_to_target" &&
                    competition.target_score != null
                      ? ` · ${Number(competition.target_score).toFixed(2)}`
                      : ""}
                  </span>
                </div>
              </div>

            {competition.linked_bar_key?.trim() ||
            competition.location_name?.trim() ||
            competition.location_address?.trim() ? (
              <div
                className={`space-y-1.5 border-t pt-4 text-sm leading-relaxed ${competitionCardDividerClass}`}
              >
                {competition.linked_bar_key?.trim() ? (
                  <p className="text-guinness-tan/85">
                    <span className="text-guinness-tan/50">
                      {t("pages.competitionDetail.directoryPrefix")}
                    </span>
                    <Link
                      to={pubDetailPath(competition.linked_bar_key.trim())}
                      viewTransition
                      className="font-medium text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 hover:decoration-guinness-gold"
                    >
                      {t("pages.competitionDetail.openPubPage")}
                    </Link>
                  </p>
                ) : null}
                {competition.location_name?.trim() ||
                competition.location_address?.trim() ? (
                  <p className="text-guinness-cream">
                    <span className="text-guinness-tan/50">
                      {t("pages.competitionDetail.venuePrefix")}
                    </span>
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
              className={`flex flex-col gap-4 border-t pt-4 ${competitionCardDividerClass} ${
                hideSummaryJoinStripOnMd ? "md:hidden" : ""
              }`}
              aria-label={t("pages.competitionDetail.ariaCompetitionActions")}
            >
              {!userId ? (
                <p className="type-meta text-guinness-tan/70">
                  {t("pages.competitionDetail.signInToJoinPour")}
                </p>
              ) : joined ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    {canSubmit ? (
                      <Link
                        to={`/?competition=${encodeURIComponent(competition.id)}`}
                        viewTransition
                        className={`${pageHeaderActionButtonClass} w-full`}
                      >
                        {t("pages.competitionDetail.newPourForComp")}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleLeave()}
                      className="w-full rounded-lg border border-[#312814] bg-transparent px-4 py-2.5 text-sm font-medium text-guinness-tan/90 transition-colors hover:bg-[#312814]/30"
                    >
                      {t("pages.competitionDetail.leaveCompetition")}
                    </button>
                  </div>
                  {canSubmit ? (
                    <details className="type-meta rounded-lg border border-[#312814] bg-guinness-black/20 px-3 py-2.5 text-guinness-tan/60">
                      <summary className="cursor-pointer select-none text-sm font-medium text-guinness-tan/75 hover:text-guinness-tan">
                        {t("pages.competitionDetail.howPoursCount")}
                      </summary>
                      <p className="mt-3 border-t border-[#312814] pt-3 text-guinness-tan/55">
                        {t("pages.competitionDetail.howPoursCountBody")}
                      </p>
                    </details>
                  ) : null}
                </div>
              ) : userId && !joined ? (
                timePhase?.phase === "after" ? (
                  <button
                    type="button"
                    onClick={() => void handleJoin()}
                    className={`${pageHeaderActionButtonClass} w-full`}
                  >
                    {t("pages.competitionDetail.joinCompetition")}
                  </button>
                ) : rosterFull ? (
                  <>
                    <p className="type-meta hidden text-guinness-tan/65 md:block">
                      {t("pages.competitions.full")}
                    </p>
                    <button
                      type="button"
                      disabled
                      className={`${pageHeaderActionButtonClass} w-full cursor-not-allowed opacity-50 md:hidden`}
                    >
                      {t("pages.competitions.full")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleJoin()}
                    className={`${pageHeaderActionButtonClass} w-full md:hidden`}
                  >
                    {t("pages.competitionDetail.joinCompetition")}
                  </button>
                )
              ) : null}
            </div>
            </div>
          </div>
        </section>

        <section
          id="comp-leaderboard-panel"
          className="order-2 scroll-mt-28"
          aria-label={t("pages.competitionDetail.ariaLeaderboardRoster")}
        >
          <SegmentedTabs
            className="mb-4 flex w-full md:mb-6"
            layoutClassName="flex w-full"
            variant="rowEqual"
            role="tablist"
            aria-label={t("pages.competitionDetail.ariaLeaderboardRosterTabs")}
            tabIdPrefix="tab-comp"
            value={rightColTab}
            onValueChange={(v) =>
              setRightColTab(v === "participants" ? "participants" : "leaderboard")
            }
            items={[
              {
                value: "leaderboard",
                label: t("pages.competitionDetail.tabLeaderboard"),
                panelId: "panel-comp-leaderboard",
              },
              {
                value: "participants",
                label: t("pages.competitionDetail.tabWhosIn"),
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
                {t("pages.competitionDetail.scoresLimited", {
                  limit: String(COMPETITION_SCORE_LIMIT),
                })}
              </p>
            ) : null}
            {ranked.length === 0 ? (
              <p className="type-meta mx-auto max-w-md rounded-xl border border-solid border-guinness-frame bg-black/25 px-4 py-5 text-center text-sm leading-relaxed text-guinness-tan/75 sm:px-5">
                {timePhase?.phase === "after" ? (
                  t("pages.competitionDetail.emptyLeaderboardAfter")
                ) : (
                  <>
                    {t("pages.competitionDetail.emptyLeaderboardWaitingBefore")}{" "}
                    <span className="text-guinness-tan/85">
                      {t("pages.competitionDetail.newPourForComp")}
                    </span>{" "}
                    {t("pages.competitionDetail.emptyLeaderboardWaitingAfter")}
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
                            : "border border-solid border-guinness-frame hover:border-guinness-gold/30 hover:bg-guinness-brown/50"
                        }`}
                      >
                        <Link
                          to={localizePath(r.pourPath, lang)}
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
                                      {t("pages.competitionDetail.winnerBadge")}
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
                          <div className="flex min-w-0 shrink-0 flex-col justify-center border-t border-solid border-guinness-frame px-4 py-3 sm:max-w-[12rem] sm:border-l sm:border-t-0 sm:px-4">
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
            <h3 className="sr-only">
              {t("pages.competitionDetail.srOnlyWhosIn")}
            </h3>
            <p className="type-meta mb-4 text-guinness-tan/70">
              {userId
                ? t("pages.competitionDetail.participantsBlurbSignedIn")
                : t("pages.competitionDetail.participantsBlurbSignedOut")}
            </p>
            {sortedParticipantUserIds.length === 0 ? (
              <p className="type-meta text-guinness-tan/60">
                {t("pages.competitionDetail.participantsEmpty")}
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
                            {t("pages.competitionDetail.youParen")}
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
            ? t("toasts.toastDangerTitle")
            : message && competitionDetailMessageVariant(message) === "warning"
              ? t("pages.competitionDetail.toastWarningTitle")
              : message && competitionDetailMessageVariant(message) === "info"
                ? t("pages.competitionDetail.toastInfoTitle")
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
