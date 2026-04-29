import { useCallback, useEffect, useMemo, useState } from "react";
import type { TranslateFn } from "~/i18n/translate";
import {
  buildLeaderboard,
  COMPETITION_SCORE_LIMIT,
  COMPETITION_SCORES_SELECT,
  unwrapScore,
  type CompetitionScoreJoin,
} from "~/utils/competitionLeaderboard";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import {
  getSupabaseAccessToken,
  useSupabaseAuthUser,
} from "~/utils/supabase-auth";
import type { CompetitionRow } from "./competitions.shared";
import {
  normalizeEmail,
  type ParticipantProfilePick,
  type WinRule,
} from "./competitions.$competitionId.shared";

type TimePhase =
  | { phase: "before"; ms: number }
  | { phase: "live"; ms: number }
  | { phase: "after"; ms: 0 }
  | null;

type UseCompetitionDetailStateArgs = {
  competition: CompetitionRow | null;
  effectiveId: string | null;
  t: TranslateFn;
};

export function useCompetitionDetailState({
  competition,
  effectiveId,
  t,
}: UseCompetitionDetailStateArgs) {
  const { user, userId, userEmail } = useSupabaseAuthUser();
  const [joined, setJoined] = useState(false);
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

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const refreshAll = useCallback(async () => {
    const id = effectiveId;
    if (!id) return;

    const supabase = await getSupabaseBrowserClient();
    const uid = userId;
    const normalizedEmail = userEmail ? normalizeEmail(userEmail) : null;

    const [{ data: allParticipants }, { data: competitionScoreRows }] =
      await Promise.all([
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

    const participantIds = [
      ...new Set(
        (allParticipants ?? [])
          .map((row) => row.user_id as string | null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    setParticipantUserIds(participantIds);
    setJoined(uid ? participantIds.includes(uid) : false);

    const profilesPromise = participantIds.length
      ? supabase
          .from("public_profiles")
          .select("user_id, nickname, display_name, country_code")
          .in("user_id", participantIds)
      : Promise.resolve({ data: null } as { data: null });
    const friendsPromise =
      uid && normalizedEmail
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

    const [profilesResult, friendsResult] = await Promise.all([
      profilesPromise,
      friendsPromise,
    ]);

    if (profilesResult.data) {
      const nextProfiles: Record<string, ParticipantProfilePick> = {};
      for (const profile of profilesResult.data) {
        const participantId = profile.user_id as string;
        const countryCodeRaw =
          profile.country_code != null ? String(profile.country_code).trim() : "";
        nextProfiles[participantId] = {
          nickname: profile.nickname as string | null | undefined,
          display_name: profile.display_name as string | null | undefined,
          country_code: countryCodeRaw || null,
        };
      }
      setParticipantProfiles(nextProfiles);
    } else {
      setParticipantProfiles({});
    }

    if (friendsResult) {
      const [friendsRows, outgoingRequestRows] = friendsResult;
      const nextPeerIds = new Set<string>();
      for (const row of friendsRows.data ?? []) {
        if (row.user_id === uid) nextPeerIds.add(row.friend_user_id as string);
        else if (row.friend_user_id === uid) nextPeerIds.add(row.user_id as string);
      }
      setFriendPeerIds(nextPeerIds);

      const nextPendingEmails = new Set<string>();
      for (const row of outgoingRequestRows.data ?? []) {
        const normalized = normalizeEmail(String(row.to_email ?? ""));
        if (normalized) nextPendingEmails.add(normalized);
      }
      setPendingFriendEmails(nextPendingEmails);
    } else {
      setFriendPeerIds(new Set());
      setPendingFriendEmails(new Set());
    }

    const nextScores = (competitionScoreRows ?? []) as CompetitionScoreJoin[];
    setScoresJoined(nextScores);
    setScoresLimited(nextScores.length >= COMPETITION_SCORE_LIMIT);
  }, [effectiveId, userEmail, userId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const ranked = useMemo(() => {
    if (!competition) return [];
    const target =
      competition.target_score != null ? Number(competition.target_score) : null;
    return buildLeaderboard(
      scoresJoined,
      competition.win_rule as WinRule,
      target,
    );
  }, [competition, scoresJoined]);

  const emailByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of scoresJoined) {
      const uid = row.user_id;
      if (!uid) continue;
      const score = unwrapScore(row.scores);
      const raw = score?.email?.trim();
      if (!raw) continue;
      if (!map.has(uid)) map.set(uid, raw);
    }
    return map;
  }, [scoresJoined]);

  const rankedUsernameByUserId = useMemo(
    () => new Map(ranked.map((row) => [row.userId, row.username])),
    [ranked],
  );

  const participantLabel = useCallback(
    (uid: string) => {
      const profile = participantProfiles[uid];
      return (
        profile?.nickname?.trim() ||
        profile?.display_name?.trim() ||
        rankedUsernameByUserId.get(uid) ||
        t("pages.competitionDetail.defaultPlayer")
      );
    },
    [participantProfiles, rankedUsernameByUserId, t],
  );

  const sortedParticipantUserIds = useMemo(() => {
    const ids = [...participantUserIds];
    ids.sort((a, b) => {
      if (userId) {
        if (a === userId) return -1;
        if (b === userId) return 1;
      }
      return participantLabel(a).localeCompare(participantLabel(b), undefined, {
        sensitivity: "base",
      });
    });
    return ids;
  }, [participantLabel, participantUserIds, userId]);

  const sendFriendInviteToPeer = useCallback(
    async (toEmail: string, peerUserId: string) => {
      const me = user;
      if (!me?.id || !me.email) {
        setMessage(t("pages.competitionDetail.msgSignInAddFriends"));
        return;
      }
      const supabase = await getSupabaseBrowserClient();
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
        const accessToken = await getSupabaseAccessToken();
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
    [pendingFriendEmails, t, user],
  );

  async function handleJoin() {
    if (!effectiveId) return;
    setMessage(null);
    if (!user) {
      setMessage(t("pages.competitionDetail.msgSignInToJoin"));
      return;
    }
    const supabase = await getSupabaseBrowserClient();

    const { error } = await supabase.from("competition_participants").insert({
      competition_id: effectiveId,
      user_id: user.id,
    });
    if (error) {
      setMessage(error.message);
      return;
    }

    setJoined(true);
    void refreshAll();
    setMessage(t("pages.competitionDetail.msgWelcomeJoin"));
  }

  async function handleLeave() {
    if (!effectiveId) return;
    setMessage(null);
    if (!user) return;
    const supabase = await getSupabaseBrowserClient();

    const { error } = await supabase
      .from("competition_participants")
      .delete()
      .eq("competition_id", effectiveId)
      .eq("user_id", user.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setJoined(false);
    void refreshAll();
    setMessage(t("pages.competitionDetail.msgLeftComp"));
  }

  const timePhase = useMemo<TimePhase>(() => {
    if (!competition) return null;
    const start = new Date(competition.starts_at).getTime();
    const end = new Date(competition.ends_at).getTime();
    if (nowMs < start) return { phase: "before", ms: start - nowMs };
    if (nowMs > end) return { phase: "after", ms: 0 };
    return { phase: "live", ms: end - nowMs };
  }, [competition, nowMs]);

  return {
    joined,
    userId,
    userEmail,
    scoresLimited,
    message,
    participantUserIds,
    participantProfiles,
    friendPeerIds,
    pendingFriendEmails,
    friendInviteBusy,
    ranked,
    sortedParticipantUserIds,
    emailByUserId,
    participantLabel,
    timePhase,
    handleJoin,
    handleLeave,
    sendFriendInviteToPeer,
    dismissMessage: () => setMessage(null),
  };
}
