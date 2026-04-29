import { useEffect, useMemo, useState } from "react";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import type { TranslateFn } from "~/i18n/translate";
import { analyticsEventNames } from "~/utils/analytics/events";
import { trackEvent } from "~/utils/analytics/client";
import { competitionDetailPath } from "~/utils/competitionPath";
import {
  buildLeaderboard,
  COMPETITION_SCORE_LIMIT,
  COMPETITION_SCORES_SELECT,
  type CompetitionScoreJoin,
} from "~/utils/competitionLeaderboard";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import {
  COMPETITION_ROW_SELECT,
  type CompetitionRow,
  type FriendPick,
  type InviteRow,
} from "./competitions.shared";

type UiToastState = {
  text: string;
  variant: BrandedNoticeVariant;
} | null;

type UseCompetitionsListStateArgs = {
  competitions: CompetitionRow[];
  loaderCounts: Record<string, number>;
  revalidatorState: string;
  revalidate: () => void;
  t: TranslateFn;
};

export function useCompetitionsListState({
  competitions,
  loaderCounts,
  revalidatorState,
  revalidate,
  t,
}: UseCompetitionsListStateArgs) {
  const [formError, setFormError] = useState<string | null>(null);
  const [uiToast, setUiToast] = useState<UiToastState>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompetitionRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [clientComps, setClientComps] = useState<CompetitionRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(loaderCounts);
  const [myFriends, setMyFriends] = useState<FriendPick[]>([]);
  const [invitesByComp, setInvitesByComp] = useState<Record<string, InviteRow[]>>({});
  const [inviteInputs, setInviteInputs] = useState<Record<string, string>>({});
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [invitedTitles, setInvitedTitles] = useState<
    { competition_id: string; title: string }[]
  >([]);
  const [listingsTab, setListingsTab] = useState<"open" | "past">("open");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pastWinnerByCompId, setPastWinnerByCompId] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCounts(loaderCounts);
  }, [loaderCounts]);

  const mergedCompetitions = useMemo(() => {
    if (!userId || clientComps === null) return competitions;
    const map = new Map<string, CompetitionRow>();
    for (const competition of competitions) map.set(competition.id, competition);
    for (const competition of clientComps) map.set(competition.id, competition);
    return [...map.values()].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [competitions, clientComps, userId]);

  const { openCompetitions, pastCompetitions } = useMemo(() => {
    const open: CompetitionRow[] = [];
    const past: CompetitionRow[] = [];
    for (const competition of mergedCompetitions) {
      if (new Date(competition.ends_at).getTime() > nowMs) open.push(competition);
      else past.push(competition);
    }
    return { openCompetitions: open, pastCompetitions: past };
  }, [mergedCompetitions, nowMs]);

  const visibleCompetitions =
    listingsTab === "open" ? openCompetitions : pastCompetitions;

  useEffect(() => {
    let cancelled = false;
    if (pastCompetitions.length === 0) {
      setPastWinnerByCompId({});
      return;
    }
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const entries = await Promise.all(
        pastCompetitions.map(async (competition) => {
          const { data } = await supabase
            .from("competition_scores")
            .select(COMPETITION_SCORES_SELECT)
            .eq("competition_id", competition.id)
            .order("created_at", { ascending: false })
            .limit(COMPETITION_SCORE_LIMIT);
          const rows = (data ?? []) as CompetitionScoreJoin[];
          const target =
            competition.target_score != null ? Number(competition.target_score) : null;
          const ranked = buildLeaderboard(rows, competition.win_rule, target);
          const winner = ranked[0]?.username ?? null;
          return [competition.id, winner] as const;
        }),
      );
      if (!cancelled) {
        setPastWinnerByCompId(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pastCompetitions]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function syncJoined() {
      const supabase = await getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const email = auth.user?.email?.trim().toLowerCase() ?? null;
      if (cancelled) return;
      setUserId(uid);
      setUserEmail(email);
      if (!uid) {
        setJoinedIds(new Set());
        setClientComps(null);
        return;
      }

      const { data: rows } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .eq("user_id", uid);
      if (cancelled) return;
      setJoinedIds(new Set((rows ?? []).map((row) => row.competition_id as string)));

      const joinedCompIds = (rows ?? []).map((row) => row.competition_id as string);
      const { data: ownedRows } = await supabase
        .from("competitions")
        .select("id")
        .eq("created_by", uid);
      if (cancelled) return;

      const ownedIds = (ownedRows ?? []).map((row) => row.id as string);
      const idSet = new Set<string>([...joinedCompIds, ...ownedIds]);
      if (idSet.size === 0) {
        setClientComps([]);
        return;
      }

      const { data: comps } = await supabase
        .from("competitions")
        .select(COMPETITION_ROW_SELECT)
        .in("id", [...idSet]);
      if (cancelled) return;
      setClientComps((comps ?? []) as CompetitionRow[]);
    }

    void syncJoined();
    void getSupabaseBrowserClient().then((supabase) => {
      if (cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        void syncJoined();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [revalidatorState]);

  useEffect(() => {
    const ids = mergedCompetitions
      .map((competition) => competition.id)
      .filter((id) => loaderCounts[id] == null);
    if (ids.length === 0) return;
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .in("competition_id", ids);
      const nextCounts: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = row.competition_id as string;
        nextCounts[id] = (nextCounts[id] ?? 0) + 1;
      }
      setCounts((prev) => ({ ...prev, ...nextCounts }));
    })();
  }, [mergedCompetitions, loaderCounts]);

  useEffect(() => {
    if (!userId) {
      setMyFriends([]);
      return;
    }
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("user_friends")
        .select("friend_user_id, peer_email")
        .eq("user_id", userId);
      setMyFriends((data ?? []) as FriendPick[]);
    })();
  }, [userId, revalidatorState]);

  useEffect(() => {
    if (!userId) {
      setInvitesByComp({});
      return;
    }
    const ownedCompetitionIds = mergedCompetitions
      .filter((competition) => competition.created_by === userId)
      .map((competition) => competition.id);
    if (ownedCompetitionIds.length === 0) {
      setInvitesByComp({});
      return;
    }
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("competition_invites")
        .select("id, competition_id, invited_email")
        .in("competition_id", ownedCompetitionIds);
      const nextInvites: Record<string, InviteRow[]> = {};
      for (const row of data ?? []) {
        const competitionId = row.competition_id as string;
        if (!nextInvites[competitionId]) nextInvites[competitionId] = [];
        nextInvites[competitionId].push({
          id: row.id as string,
          invited_email: String(row.invited_email),
        });
      }
      setInvitesByComp(nextInvites);
    })();
  }, [userId, mergedCompetitions]);

  useEffect(() => {
    if (!userId || !userEmail) {
      setInvitedTitles([]);
      return;
    }
    const normalizedEmail = userEmail.trim().toLowerCase();
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data: invites } = await supabase
        .from("competition_invites")
        .select("competition_id")
        .eq("invited_email", normalizedEmail);
      if (!invites || invites.length === 0) {
        setInvitedTitles([]);
        return;
      }
      const ids = [...new Set(invites.map((row) => row.competition_id as string))];
      const { data: comps } = await supabase
        .from("competitions")
        .select("id, title")
        .in("id", ids);
      setInvitedTitles(
        (comps ?? []).map((competition) => ({
          competition_id: competition.id as string,
          title: String(competition.title),
        })),
      );
    })();
  }, [userId, userEmail]);

  async function requestDeleteCompetition(competition: CompetitionRow) {
    setFormError(null);
    const supabase = await getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || userData.user.id !== competition.created_by) {
      setFormError(t("pages.competitions.errDeleteOwnOnly"));
      return;
    }
    setDeleteTarget(competition);
  }

  async function confirmDeleteCompetition() {
    if (!deleteTarget) return;
    const competition = deleteTarget;
    setDeleteTarget(null);
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase
      .from("competitions")
      .delete()
      .eq("id", competition.id);
    if (error) {
      setFormError(error.message);
      return;
    }
    revalidate();
    setUiToast({
      text: t("pages.competitions.msgDeleted"),
      variant: "success",
    });
  }

  async function handleJoin(compId: string) {
    setFormError(null);
    const supabase = await getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setFormError(t("pages.competitions.errSignInToJoin"));
      return;
    }

    const competition = mergedCompetitions.find((entry) => entry.id === compId);
    const count = counts[compId] ?? 0;
    if (!competition || count >= competition.max_participants) {
      setFormError(t("pages.competitions.errCompetitionFull"));
      return;
    }
    if (joinedIds.has(compId)) return;

    const { error } = await supabase.from("competition_participants").insert({
      competition_id: compId,
      user_id: userData.user.id,
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    setJoinedIds((prev) => new Set(prev).add(compId));
    trackEvent(analyticsEventNames.competitionJoined, { competitionId: compId });
    revalidate();
    setUiToast({ text: t("pages.competitions.msgJoined"), variant: "success" });
  }

  async function handleLeave(compId: string) {
    setFormError(null);
    const supabase = await getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase
      .from("competition_participants")
      .delete()
      .eq("competition_id", compId)
      .eq("user_id", userData.user.id);

    if (error) {
      setFormError(error.message);
      return;
    }
    setJoinedIds((prev) => {
      const next = new Set(prev);
      next.delete(compId);
      return next;
    });
    trackEvent(analyticsEventNames.competitionLeft, { competitionId: compId });
    revalidate();
    setUiToast({ text: t("pages.competitions.msgLeft"), variant: "info" });
  }

  async function addEmailInvite(compId: string) {
    const raw = (inviteInputs[compId] ?? "").trim().toLowerCase();
    if (!raw || !raw.includes("@")) {
      setFormError(t("pages.competitions.errValidEmailInvite"));
      return;
    }
    setInviteBusy(compId);
    setFormError(null);

    const supabase = await getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) {
      setInviteBusy(null);
      setFormError(t("pages.competitions.errSignInToInvite"));
      return;
    }

    const { error } = await supabase.from("competition_invites").insert({
      competition_id: compId,
      invited_email: raw,
      invited_by: userData.user.id,
    });
    if (error) {
      setInviteBusy(null);
      setFormError(error.message);
      return;
    }

    setInviteInputs((prev) => ({ ...prev, [compId]: "" }));
    revalidate();

    const competition = mergedCompetitions.find((entry) => entry.id === compId);
    const inviterName =
      (userData.user.user_metadata?.full_name as string | undefined)?.trim() ||
      (userData.user.user_metadata?.name as string | undefined)?.trim() ||
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
          type: "competition_invite_received",
          toEmail: raw,
          actorName: inviterName,
          competitionTitle: competition?.title ?? null,
          path: competitionDetailPath(
            competition ?? { id: compId, path_segment: null },
          ),
        }),
      }).catch(() => null);
    }

    let emailOk = false;
    try {
      const emailResponse = await fetch("/api/friend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviterEmail: userData.user.email,
          inviterName,
          toEmail: raw,
          invitePath: competitionDetailPath(
            competition ?? { id: compId, path_segment: null },
          ),
          competitionTitle: competition?.title ?? null,
        }),
      });
      emailOk = emailResponse.ok;
    } catch {
      emailOk = false;
    }

    setInviteBusy(null);
    setUiToast({
      text: emailOk
        ? t("pages.competitions.msgInviteEmailSent")
        : t("pages.competitions.msgInviteSavedNoEmail"),
      variant: emailOk ? "success" : "warning",
    });
  }

  async function removeInvite(_compId: string, inviteId: string) {
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase
      .from("competition_invites")
      .delete()
      .eq("id", inviteId);
    if (error) {
      setFormError(error.message);
      return;
    }
    revalidate();
    setUiToast({ text: t("pages.competitions.msgInviteRemoved"), variant: "info" });
  }

  async function addFriendParticipant(compId: string, friendUserId: string) {
    setFormError(null);
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.from("competition_participants").insert({
      competition_id: compId,
      user_id: friendUserId,
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    revalidate();
    setUiToast({
      text: t("pages.competitions.msgFriendAddedToComp"),
      variant: "success",
    });
  }

  return {
    formError,
    uiToast,
    deleteTarget,
    counts,
    myFriends,
    invitesByComp,
    inviteInputs,
    inviteBusy,
    invitedTitles,
    listingsTab,
    userId,
    userEmail,
    joinedIds,
    pastWinnerByCompId,
    openCompetitions,
    pastCompetitions,
    mergedCompetitions,
    visibleCompetitions,
    setInviteInputs,
    setListingsTab,
    requestDeleteCompetition,
    confirmDeleteCompetition,
    handleJoin,
    handleLeave,
    addEmailInvite,
    removeInvite,
    addFriendParticipant,
    dismissToast: () => {
      setFormError(null);
      setUiToast(null);
    },
    closeDeleteNotice: () => setDeleteTarget(null),
  };
}
