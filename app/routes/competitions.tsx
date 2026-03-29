import { useLoaderData, useRevalidator } from "react-router";
import { AppLink } from "~/i18n/app-link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import { BrandedNotice } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { CompetitionDateTimeRangeField } from "~/components/competitions/CompetitionDateTimeRangeField";
import { CompetitionLocationField } from "~/components/competitions/CompetitionLocationField";
import { SegmentedTabs } from "~/components/ui/segmented-tabs";
import { competitionDetailPath } from "~/utils/competitionPath";
import {
  buildLeaderboard,
  COMPETITION_SCORE_LIMIT,
  COMPETITION_SCORES_SELECT,
  type CompetitionScoreJoin,
} from "~/utils/competitionLeaderboard";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import type { loader as competitionsLoader } from "./competitions.loader";
import {
  COMPETITION_ROW_SELECT,
  competitionFieldClass,
  competitionOutlineButtonClass,
  competitionSelectFieldClass,
  isPrivateCompetition,
  toDatetimeLocalValue,
  type BarLinkOption,
  type CompetitionRow,
  type FriendPick,
  type InviteRow,
  type WinRuleChoice,
} from "./competitions.shared";

export { loader } from "./competitions.loader";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/competitions", "competitions");
}

export default function Competitions() {
  const { t } = useI18n();
  const { competitions, listError, participantCounts: loaderCounts } =
    useLoaderData<typeof competitionsLoader>();
  const revalidator = useRevalidator();

  const competitionDateCopy = useMemo(
    () => ({
      chooseWindow: t("pages.competitions.dateChooseWindow"),
      dialogAriaLabel: t("pages.competitions.dateDialogAria"),
      timesLocal: t("pages.competitions.dateTimesLocal"),
      start: t("pages.competitions.dateStart"),
      end: t("pages.competitions.dateEnd"),
      clear: t("pages.competitions.dateClear"),
      done: t("pages.competitions.dateDone"),
      sectionLabel: t("pages.competitions.dateSectionLabel"),
      hint: t("pages.competitions.dateHint"),
    }),
    [t],
  );

  const competitionLocationCopy = useMemo(
    () => ({
      locationLabel: t("pages.competitions.locationLabel"),
      optionalSuffix: t("pages.competitions.locationOptional"),
      hint: t("pages.competitions.locationHint"),
      mapPreviewTitle: t("pages.competitions.mapPreviewTitle"),
    }),
    [t],
  );

  function winRuleLabelI18n(rule: string): string {
    switch (rule) {
      case "closest_to_target":
        return t("pages.competitions.winRuleOptionClosest");
      case "most_submissions":
        return t("pages.competitions.winRuleOptionMost");
      default:
        return t("pages.competitions.winRuleOptionHighest");
    }
  }
  const [title, setTitle] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [glassesPerPerson, setGlassesPerPerson] = useState(1);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createPublic, setCreatePublic] = useState(true);
  const [createWinRule, setCreateWinRule] = useState<WinRuleChoice>("highest_score");
  const [createTargetScore, setCreateTargetScore] = useState("2.50");
  const [createLocationName, setCreateLocationName] = useState("");
  const [createLocationAddress, setCreateLocationAddress] = useState("");
  const [createLinkedBarKey, setCreateLinkedBarKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [uiToast, setUiToast] = useState<{
    text: string;
    variant: BrandedNoticeVariant;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompetitionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CompetitionRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMax, setEditMax] = useState(8);
  const [editGlasses, setEditGlasses] = useState(1);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [editWinRule, setEditWinRule] = useState<WinRuleChoice>("highest_score");
  const [editTargetScore, setEditTargetScore] = useState("2.50");
  const [editLocationName, setEditLocationName] = useState("");
  const [editLocationAddress, setEditLocationAddress] = useState("");
  const [editLinkedBarKey, setEditLinkedBarKey] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [clientComps, setClientComps] = useState<CompetitionRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(loaderCounts);
  const [myFriends, setMyFriends] = useState<FriendPick[]>([]);
  const [createFormOpen, setCreateFormOpen] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    function sync() {
      setCreateFormOpen(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [invitesByComp, setInvitesByComp] = useState<
    Record<string, InviteRow[]>
  >({});
  const [inviteInputs, setInviteInputs] = useState<Record<string, string>>({});
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [invitedTitles, setInvitedTitles] = useState<
    { competition_id: string; title: string }[]
  >([]);
  const [barLinkOptions, setBarLinkOptions] = useState<BarLinkOption[]>([]);
  const [listingsTab, setListingsTab] = useState<"open" | "past">("open");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pastWinnerByCompId, setPastWinnerByCompId] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setCounts(loaderCounts);
  }, [loaderCounts]);

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("bar_pub_stats")
        .select("bar_key, display_name")
        .order("submission_count", { ascending: false })
        .limit(200);
      setBarLinkOptions((data ?? []) as BarLinkOption[]);
    })();
  }, []);

  const mergedCompetitions = useMemo(() => {
    if (!userId || !clientComps) return competitions;
    const map = new Map<string, CompetitionRow>();
    for (const c of competitions) map.set(c.id, c);
    for (const c of clientComps) map.set(c.id, c);
    return [...map.values()].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [competitions, clientComps, userId]);

  const { openCompetitions, pastCompetitions } = useMemo(() => {
    const open: CompetitionRow[] = [];
    const past: CompetitionRow[] = [];
    for (const c of mergedCompetitions) {
      if (new Date(c.ends_at).getTime() > nowMs) open.push(c);
      else past.push(c);
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
        pastCompetitions.map(async (c) => {
          const { data } = await supabase
            .from("competition_scores")
            .select(COMPETITION_SCORES_SELECT)
            .eq("competition_id", c.id)
            .order("created_at", { ascending: false })
            .limit(COMPETITION_SCORE_LIMIT);
          const rows = (data ?? []) as CompetitionScoreJoin[];
          const target =
            c.target_score != null ? Number(c.target_score) : null;
          const ranked = buildLeaderboard(rows, c.win_rule, target);
          const winner = ranked[0]?.username ?? null;
          return [c.id, winner] as const;
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
      const em = auth.user?.email?.trim().toLowerCase() ?? null;
      if (cancelled) return;
      setUserId(uid);
      setUserEmail(em);
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
      setJoinedIds(new Set((rows ?? []).map((r) => r.competition_id as string)));

      const joinedCompIds = (rows ?? []).map((r) => r.competition_id as string);
      if (joinedCompIds.length === 0) {
        setClientComps(null);
        return;
      }
      const { data: comps } = await supabase
        .from("competitions")
        .select(COMPETITION_ROW_SELECT)
        .in("id", joinedCompIds);
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
  }, []);

  useEffect(() => {
    const list = mergedCompetitions;
    if (list.length === 0) return;
    const ids = list
      .map((c) => c.id)
      .filter((id) => loaderCounts[id] == null);
    if (ids.length === 0) return;
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .in("competition_id", ids);
      const m: Record<string, number> = {};
      for (const r of data ?? []) {
        const id = r.competition_id as string;
        m[id] = (m[id] ?? 0) + 1;
      }
      setCounts((prev) => ({ ...prev, ...m }));
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
  }, [userId, revalidator.state]);

  useEffect(() => {
    if (!userId) {
      setInvitesByComp({});
      return;
    }
    const owned = mergedCompetitions
      .filter((c) => c.created_by === userId)
      .map((c) => c.id);
    if (owned.length === 0) {
      setInvitesByComp({});
      return;
    }
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("competition_invites")
        .select("id, competition_id, invited_email")
        .in("competition_id", owned);
      const m: Record<string, InviteRow[]> = {};
      for (const row of data ?? []) {
        const cid = row.competition_id as string;
        if (!m[cid]) m[cid] = [];
        m[cid].push({
          id: row.id as string,
          invited_email: String(row.invited_email),
        });
      }
      setInvitesByComp(m);
    })();
  }, [userId, mergedCompetitions]);

  useEffect(() => {
    if (!userId || !userEmail) {
      setInvitedTitles([]);
      return;
    }
    const norm = userEmail.trim().toLowerCase();
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data: inv } = await supabase
        .from("competition_invites")
        .select("competition_id")
        .eq("invited_email", norm);
      if (!inv || inv.length === 0) {
        setInvitedTitles([]);
        return;
      }
      const ids = [...new Set(inv.map((r) => r.competition_id as string))];
      const { data: comps } = await supabase
        .from("competitions")
        .select("id, title")
        .in("id", ids);
      setInvitedTitles(
        (comps ?? []).map((c) => ({
          competition_id: c.id as string,
          title: String(c.title),
        })),
      );
    })();
  }, [userId, userEmail]);

  function beginEdit(c: CompetitionRow) {
    setEditing(c);
    setEditTitle(c.title);
    setEditMax(c.max_participants);
    setEditGlasses(c.glasses_per_person);
    setEditStart(toDatetimeLocalValue(c.starts_at));
    setEditEnd(toDatetimeLocalValue(c.ends_at));
    setEditPublic(!isPrivateCompetition(c));
    const wr = (c.win_rule ?? "highest_score") as WinRuleChoice;
    setEditWinRule(
      wr === "closest_to_target" || wr === "most_submissions"
        ? wr
        : "highest_score",
    );
    setEditTargetScore(
      c.target_score != null ? String(c.target_score) : "2.50",
    );
    setEditLocationName(c.location_name?.trim() ?? "");
    setEditLocationAddress(c.location_address?.trim() ?? "");
    setEditLinkedBarKey(c.linked_bar_key?.trim() ?? "");
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setFormError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const supabase = await getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setFormError(t("pages.competitions.errSignInGoogleFirst"));
        return;
      }

      if (!title.trim()) {
        setFormError(t("pages.competitions.errGiveName"));
        return;
      }
      if (!startsAt || !endsAt) {
        setFormError(t("pages.competitions.errChooseTimes"));
        return;
      }

      const starts = new Date(startsAt);
      const ends = new Date(endsAt);
      if (ends <= starts) {
        setFormError(t("pages.competitions.errEndAfterStart"));
        return;
      }

      let target: number | null = null;
      if (createWinRule === "closest_to_target") {
        const parsedTarget = parseFloat(createTargetScore);
        if (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 5) {
          setFormError(t("pages.competitions.errTargetScoreRange"));
          return;
        }
        target = parsedTarget;
      }

      const { error } = await supabase.from("competitions").insert({
        title: title.trim(),
        created_by: userData.user.id,
        max_participants: maxParticipants,
        glasses_per_person: glassesPerPerson,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        win_rule: createWinRule,
        target_score: target,
        visibility: createPublic ? "public" : "private",
        location_name: createLocationName.trim() || null,
        location_address: createLocationAddress.trim() || null,
        linked_bar_key: createLinkedBarKey.trim() || null,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setCreateLocationName("");
      setCreateLocationAddress("");
      setCreateLinkedBarKey("");
      revalidator.revalidate();
      setUiToast({
        text: t("pages.competitions.msgCreated"),
        variant: "success",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    setEditBusy(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user || userData.user.id !== editing.created_by) {
        setFormError(t("pages.competitions.errEditOwnOnly"));
        return;
      }

      if (!editTitle.trim()) {
        setFormError(t("pages.competitions.errGiveName"));
        return;
      }
      if (!editStart || !editEnd) {
        setFormError(t("pages.competitions.errChooseTimes"));
        return;
      }

      const starts = new Date(editStart);
      const ends = new Date(editEnd);
      if (ends <= starts) {
        setFormError(t("pages.competitions.errEndAfterStart"));
        return;
      }

      const count = counts[editing.id] ?? 0;
      if (editMax < count) {
        setFormError(
          t("pages.competitions.errMaxBelowParticipants", {
            count: String(count),
          }),
        );
        return;
      }

      let target: number | null = null;
      if (editWinRule === "closest_to_target") {
        const parsedTarget = parseFloat(editTargetScore);
        if (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 5) {
          setFormError(t("pages.competitions.errTargetScoreRange"));
          return;
        }
        target = parsedTarget;
      }

      const { error } = await supabase
        .from("competitions")
        .update({
          title: editTitle.trim(),
          max_participants: editMax,
          glasses_per_person: editGlasses,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          win_rule: editWinRule,
          target_score: editWinRule === "closest_to_target" ? target : null,
          visibility: editPublic ? "public" : "private",
          location_name: editLocationName.trim() || null,
          location_address: editLocationAddress.trim() || null,
          linked_bar_key: editLinkedBarKey.trim() || null,
        })
        .eq("id", editing.id);

      if (error) {
        setFormError(error.message);
        return;
      }

      cancelEdit();
      revalidator.revalidate();
      setUiToast({
        text: t("pages.competitions.msgUpdated"),
        variant: "success",
      });
    } finally {
      setEditBusy(false);
    }
  }

  async function requestDeleteCompetition(c: CompetitionRow) {
    setFormError(null);
    const supabase = await getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || userData.user.id !== c.created_by) {
      setFormError(t("pages.competitions.errDeleteOwnOnly"));
      return;
    }
    setDeleteTarget(c);
  }

  async function confirmDeleteCompetition() {
    if (!deleteTarget) return;
    const c = deleteTarget;
    setDeleteTarget(null);
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.from("competitions").delete().eq("id", c.id);
    if (error) {
      setFormError(error.message);
      return;
    }
    if (editing?.id === c.id) cancelEdit();
    revalidator.revalidate();
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
    const comp = mergedCompetitions.find((x) => x.id === compId);
    const count = counts[compId] ?? 0;
    if (!comp || count >= comp.max_participants) {
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
    revalidator.revalidate();
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
    revalidator.revalidate();
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
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.email) {
      setInviteBusy(null);
      setFormError(t("pages.competitions.errSignInToInvite"));
      return;
    }
    const { error } = await supabase.from("competition_invites").insert({
      competition_id: compId,
      invited_email: raw,
      invited_by: u.user.id,
    });
    if (error) {
      setInviteBusy(null);
      setFormError(error.message);
      return;
    }
    setInviteInputs((prev) => ({ ...prev, [compId]: "" }));
    revalidator.revalidate();

    const comp = mergedCompetitions.find((c) => c.id === compId);
    const inviterName =
      (u.user.user_metadata?.full_name as string | undefined)?.trim() ||
      (u.user.user_metadata?.name as string | undefined)?.trim() ||
      null;

    let emailOk = false;
    try {
      const emailResponse = await fetch("/api/friend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviterEmail: u.user.email,
          inviterName,
          toEmail: raw,
          invitePath: competitionDetailPath(
            comp ?? { id: compId, path_segment: null },
          ),
          competitionTitle: comp?.title ?? null,
        }),
      });
      emailOk = emailResponse.ok;
    } catch {
      emailOk = false;
    }

    setInviteBusy(null);
    if (emailOk) {
      setUiToast({
        text: t("pages.competitions.msgInviteEmailSent"),
        variant: "success",
      });
    } else {
      setUiToast({
        text: t("pages.competitions.msgInviteSavedNoEmail"),
        variant: "warning",
      });
    }
  }

  async function removeInvite(compId: string, inviteId: string) {
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase
      .from("competition_invites")
      .delete()
      .eq("id", inviteId);
    if (error) setFormError(error.message);
    else {
      revalidator.revalidate();
      setUiToast({ text: t("pages.competitions.msgInviteRemoved"), variant: "info" });
    }
  }

  async function addFriendParticipant(compId: string, friendUserId: string) {
    setFormError(null);
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.from("competition_participants").insert({
      competition_id: compId,
      user_id: friendUserId,
    });
    if (error) setFormError(error.message);
    else {
      revalidator.revalidate();
      setUiToast({
        text: t("pages.competitions.msgFriendAddedToComp"),
        variant: "success",
      });
    }
  }

  const fieldClass = competitionFieldClass;
  const nativeSelectClass = competitionSelectFieldClass;
  const outlineBtn = competitionOutlineButtonClass;
  const isPrivate = isPrivateCompetition;

  const toastOpen = Boolean(formError || uiToast);
  const toastMessage = uiToast?.text ?? formError ?? "";
  const toastVariant = uiToast?.variant ?? "danger";
  const toastAuto =
    uiToast != null
      ? toastAutoCloseForVariant(uiToast.variant)
      : formError
        ? 9000
        : undefined;

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={t("pages.competitions.title")}
          description={t("pages.descriptions.competitions")}
        >
          <AppLink
            to="/profile"
            viewTransition
            className={pageHeaderActionButtonClass}
          >
            {t("pages.competitions.profileFriends")}
          </AppLink>
        </PageHeader>

        {invitedTitles.length > 0 ? (
          <div className="mb-6 rounded-lg border border-guinness-gold/30 bg-guinness-gold/10 px-4 py-3 text-sm text-guinness-cream">
            <p className="font-semibold text-guinness-gold">
              {t("pages.competitions.youreInvited")}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-guinness-tan/90">
              {invitedTitles.map((row) => (
                <li key={row.competition_id}>{row.title}</li>
              ))}
            </ul>
            <p className="type-meta mt-2 text-guinness-tan/70">
              {t("pages.competitions.invitedHint")}
            </p>
          </div>
        ) : null}

        {editing ? (
          <section className="mb-10 rounded-2xl border border-guinness-gold/35 bg-guinness-brown/50 p-5 sm:p-6 lg:p-8">
            <h2 className="type-card-title mb-6">
              {t("pages.competitions.editSectionTitle")}
            </h2>
            <form onSubmit={(ev) => void handleUpdate(ev)}>
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editPublic}
                      onChange={(e) => setEditPublic(e.target.checked)}
                      className="rounded border-guinness-gold/40"
                    />
                    <span className="text-sm text-guinness-tan/85">
                      {t("pages.competitions.publicAnyoneJoin")}
                    </span>
                  </label>
                  <div>
                    <label htmlFor="edit-win-rule" className="type-label mb-1 block">
                      {t("pages.competitions.winRuleField")}
                    </label>
                    <select
                      id="edit-win-rule"
                      value={editWinRule}
                      onChange={(e) =>
                        setEditWinRule(e.target.value as WinRuleChoice)
                      }
                      className={nativeSelectClass}
                    >
                      <option value="highest_score">
                        {t("pages.competitions.winRuleOptionHighest")}
                      </option>
                      <option value="closest_to_target">
                        {t("pages.competitions.winRuleOptionClosest")}
                      </option>
                      <option value="most_submissions">
                        {t("pages.competitions.winRuleOptionMost")}
                      </option>
                    </select>
                  </div>
                  {editWinRule === "closest_to_target" ? (
                    <div>
                      <label htmlFor="edit-target" className="type-label mb-1 block">
                        {t("pages.competitions.targetScoreLabel")}
                      </label>
                      <input
                        id="edit-target"
                        type="number"
                        step="0.01"
                        min={0}
                        max={5}
                        value={editTargetScore}
                        onChange={(e) => setEditTargetScore(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  ) : null}
                  <div>
                    <label htmlFor="edit-title" className="type-label mb-1 block">
                      {t("pages.competitions.formName")}
                    </label>
                    <input
                      id="edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={fieldClass}
                      autoComplete="off"
                    />
                  </div>
                  <CompetitionLocationField
                    key={editing.id}
                    fieldClass={fieldClass}
                    copy={competitionLocationCopy}
                    locationName={editLocationName}
                    locationAddress={editLocationAddress}
                    onLocationNameChange={setEditLocationName}
                    onLocationAddressChange={setEditLocationAddress}
                  />
                  <div>
                    <label
                      htmlFor="edit-linked-pub"
                      className="type-label mb-1 block"
                    >
                      {t("pages.competitions.pubListingsOptional")}
                    </label>
                    <select
                      id="edit-linked-pub"
                      value={editLinkedBarKey}
                      onChange={(e) => setEditLinkedBarKey(e.target.value)}
                      className={nativeSelectClass}
                    >
                      <option value="">{t("pages.competitions.pubNotLinked")}</option>
                      {barLinkOptions.map((o) => (
                        <option key={o.bar_key} value={o.bar_key}>
                          {o.display_name}
                        </option>
                      ))}
                    </select>
                    <p className="type-meta mt-1 text-guinness-tan/60">
                      {t("pages.competitions.pubListingsHintEdit")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-max" className="type-label mb-1 block">
                        {t("pages.competitions.maxPeople")}
                      </label>
                      <input
                        id="edit-max"
                        type="number"
                        min={2}
                        max={500}
                        value={editMax}
                        onChange={(e) =>
                          setEditMax(Number.parseInt(e.target.value, 10) || 2)
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-glasses" className="type-label mb-1 block">
                        {t("pages.competitions.glassesPerPerson")}
                      </label>
                      <input
                        id="edit-glasses"
                        type="number"
                        min={1}
                        max={20}
                        value={editGlasses}
                        onChange={(e) =>
                          setEditGlasses(Number.parseInt(e.target.value, 10) || 1)
                        }
                        className={fieldClass}
                      />
                    </div>
                  </div>
                  <CompetitionDateTimeRangeField
                    startLocal={editStart}
                    endLocal={editEnd}
                    onChange={(s, e) => {
                      setEditStart(s);
                      setEditEnd(e);
                    }}
                    inputClass={fieldClass}
                    copy={competitionDateCopy}
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={editBusy}
                      className="rounded-lg bg-guinness-gold px-4 py-2.5 font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50"
                    >
                      {editBusy
                        ? t("pages.competitions.saving")
                        : t("pages.competitions.saveChanges")}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-guinness-gold/30 px-4 py-2.5 text-sm font-medium text-guinness-gold hover:bg-guinness-brown/50"
                    >
                      {t("pages.competitions.formCancel")}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start xl:gap-10">
          <section className="rounded-2xl border border-guinness-gold/20 bg-guinness-brown/40 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="type-card-title">
                {t("pages.competitions.newCompetition")}
              </h2>
              <button
                type="button"
                aria-expanded={createFormOpen ? "true" : "false"}
                onClick={() => setCreateFormOpen((o) => !o)}
                className="rounded-lg border border-guinness-gold/25 px-2.5 py-1 text-xs font-semibold text-guinness-gold md:hidden"
              >
                {createFormOpen
                  ? t("pages.competitions.hide")
                  : t("pages.competitions.show")}
              </button>
            </div>
            <form
              onSubmit={(ev) => void handleCreate(ev)}
              className={`space-y-4 ${createFormOpen ? "" : "hidden md:block"}`}
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={createPublic}
                  onChange={(e) => setCreatePublic(e.target.checked)}
                  className="rounded border-guinness-gold/40"
                />
                <span className="text-sm text-guinness-tan/85">
                  {t("pages.competitions.publicListing")}
                </span>
              </label>
              <div>
                <label htmlFor="create-win-rule" className="type-label mb-1 block">
                  {t("pages.competitions.winRuleField")}
                </label>
                <select
                  id="create-win-rule"
                  value={createWinRule}
                  onChange={(e) =>
                    setCreateWinRule(e.target.value as WinRuleChoice)
                  }
                  className={nativeSelectClass}
                >
                  <option value="highest_score">
                    {t("pages.competitions.winRuleOptionHighest")}
                  </option>
                  <option value="closest_to_target">
                    {t("pages.competitions.winRuleOptionClosest")}
                  </option>
                  <option value="most_submissions">
                    {t("pages.competitions.winRuleOptionMost")}
                  </option>
                </select>
              </div>
              {createWinRule === "closest_to_target" ? (
                <div>
                  <label htmlFor="create-target" className="type-label mb-1 block">
                    {t("pages.competitions.targetScoreLabel")}
                  </label>
                  <input
                    id="create-target"
                    type="number"
                    step="0.01"
                    min={0}
                    max={5}
                    value={createTargetScore}
                    onChange={(e) => setCreateTargetScore(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              ) : null}
              <div>
                <label htmlFor="comp-title" className="type-label mb-1 block">
                  {t("pages.competitions.formName")}
                </label>
                <input
                  id="comp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={fieldClass}
                  placeholder={t("pages.competitions.namePlaceholder")}
                  autoComplete="off"
                />
              </div>
              <CompetitionLocationField
                fieldClass={fieldClass}
                copy={competitionLocationCopy}
                locationName={createLocationName}
                locationAddress={createLocationAddress}
                onLocationNameChange={setCreateLocationName}
                onLocationAddressChange={setCreateLocationAddress}
              />
              <div>
                <label
                  htmlFor="comp-linked-pub"
                  className="type-label mb-1 block"
                >
                  {t("pages.competitions.pubListingsOptional")}
                </label>
                <select
                  id="comp-linked-pub"
                  value={createLinkedBarKey}
                  onChange={(e) => setCreateLinkedBarKey(e.target.value)}
                  className={nativeSelectClass}
                >
                  <option value="">{t("pages.competitions.pubNotLinked")}</option>
                  {barLinkOptions.map((o) => (
                    <option key={o.bar_key} value={o.bar_key}>
                      {o.display_name}
                    </option>
                  ))}
                </select>
                <p className="type-meta mt-1 text-guinness-tan/60">
                  {t("pages.competitions.pubListingsHintCreate")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="comp-max" className="type-label mb-1 block">
                    {t("pages.competitions.maxPeople")}
                  </label>
                  <input
                    id="comp-max"
                    type="number"
                    min={2}
                    max={500}
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(Number.parseInt(e.target.value, 10) || 2)
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="comp-glasses" className="type-label mb-1 block">
                    {t("pages.competitions.glassesPerPerson")}
                  </label>
                  <input
                    id="comp-glasses"
                    type="number"
                    min={1}
                    max={20}
                    value={glassesPerPerson}
                    onChange={(e) =>
                      setGlassesPerPerson(
                        Number.parseInt(e.target.value, 10) || 1,
                      )
                    }
                    className={fieldClass}
                  />
                </div>
              </div>
              <CompetitionDateTimeRangeField
                startLocal={startsAt}
                endLocal={endsAt}
                onChange={(s, e) => {
                  setStartsAt(s);
                  setEndsAt(e);
                }}
                inputClass={fieldClass}
                copy={competitionDateCopy}
              />
              <p className="type-meta text-guinness-tan/65">
                {t("pages.competitions.privateExplainer")}
              </p>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-guinness-gold py-3 font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50"
              >
                {saving
                  ? t("pages.competitions.creating")
                  : t("pages.competitions.createCompetition")}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-guinness-gold/15 bg-guinness-brown/20 p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="type-card-title">
                  {t("pages.competitions.mineHeading")}
                </h2>
                <p className="type-meta mt-1 max-w-2xl text-guinness-tan/75">
                  {t("pages.descriptions.competitionsOpenListings")}
                </p>
              </div>
              <p className="type-meta shrink-0 text-guinness-tan/60">
                {t("pages.competitions.openPastCounts", {
                  open: String(openCompetitions.length),
                  past: String(pastCompetitions.length),
                })}
              </p>
            </div>

            <SegmentedTabs
              className="mb-5 w-full"
              layoutClassName="flex w-full"
              variant="rowEqual"
              aria-label={t("pages.competitions.ariaListScope")}
              value={listingsTab}
              onValueChange={(v) => setListingsTab(v === "past" ? "past" : "open")}
              items={[
                { value: "open", label: t("pages.competitions.tabOpen") },
                { value: "past", label: t("pages.competitions.tabPast") },
              ]}
            />

            {listError ? (
              <p className="type-meta rounded-lg border border-guinness-gold/20 bg-guinness-brown/30 p-4 text-guinness-tan/80">
                {t("pages.competitions.listError", { detail: listError })}
              </p>
            ) : mergedCompetitions.length === 0 ? (
              <p className="type-meta text-guinness-tan/70">
                {t("pages.competitions.noCompsYet")}
              </p>
            ) : visibleCompetitions.length === 0 ? (
              <p className="type-meta text-guinness-tan/70">
                {listingsTab === "open"
                  ? t("pages.competitions.noOpenComps")
                  : t("pages.competitions.noPastComps")}
              </p>
            ) : (
              <ul className="space-y-3">
                {visibleCompetitions.map((c) => {
                  const count = counts[c.id] ?? 0;
                  const isOwner = userId === c.created_by;
                  const isJoined = joinedIds.has(c.id);
                  const isPastTab = listingsTab === "past";
                  const full = count >= c.max_participants;
                  const priv = isPrivate(c);
                  const invites = invitesByComp[c.id] ?? [];
                  const rawWinner = pastWinnerByCompId[c.id];
                  const winnerLine =
                    rawWinner === undefined
                      ? t("pages.competitions.winnerDash")
                      : rawWinner === null
                        ? t("pages.competitions.noPoursLogged")
                        : rawWinner;

                  return (
                    <li
                      key={c.id}
                      className={`overflow-hidden rounded-2xl border bg-guinness-brown/35 ${
                        isPastTab
                          ? "border-amber-500/20"
                          : "border-guinness-gold/15"
                      }`}
                    >
                      <div className="flex flex-col gap-4 p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-guinness-cream">
                                {c.title}
                              </h3>
                              {isPastTab ? (
                                <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/95">
                                  {t("pages.competitions.badgeEnded")}
                                </span>
                              ) : null}
                              {isJoined ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                    isPastTab
                                      ? "border-guinness-tan/30 bg-guinness-black/40 text-guinness-tan/85"
                                      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200/95"
                                  }`}
                                >
                                  {isPastTab
                                    ? t("pages.competitions.badgeYouParticipated")
                                    : t("pages.competitions.badgeYoureIn")}
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  priv
                                    ? "bg-guinness-black/50 text-guinness-tan"
                                    : "bg-guinness-gold/20 text-guinness-gold"
                                }`}
                              >
                                {priv
                                  ? t("pages.competitions.badgePrivate")
                                  : t("pages.competitions.badgePublic")}
                              </span>
                            </div>
                            <p className="type-meta mt-1 text-guinness-tan/55">
                              {new Date(c.starts_at).toLocaleString()} →{" "}
                              {new Date(c.ends_at).toLocaleString()}
                            </p>
                            {isPastTab ? (
                              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-guinness-gold">
                                <span className="type-meta font-bold uppercase tracking-wide text-amber-200/90">
                                  {t("pages.competitions.winner")}
                                </span>
                                <span className="text-guinness-cream">{winnerLine}</span>
                              </p>
                            ) : null}
                          </div>

                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-[20rem] sm:flex-row sm:flex-wrap sm:justify-end">
                            <AppLink
                              to={competitionDetailPath(c)}
                              viewTransition
                              className={`${pageHeaderActionButtonClass} w-full justify-center text-xs sm:w-auto sm:min-w-[5.5rem] sm:text-sm`}
                            >
                              {t("pages.competitions.view")}
                            </AppLink>
                            {isOwner ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEdit(c)}
                                  disabled={editing !== null && editing.id !== c.id}
                                  className={`${outlineBtn} w-full sm:w-auto`}
                                >
                                  {t("pages.competitions.edit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void requestDeleteCompetition(c)}
                                  className="w-full rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-400/90 hover:bg-red-950/30 sm:w-auto sm:py-1.5"
                                >
                                  {t("pages.competitions.delete")}
                                </button>
                              </>
                            ) : userId ? (
                              isJoined ? (
                                <button
                                  type="button"
                                  onClick={() => void handleLeave(c.id)}
                                  className="w-full rounded-lg border border-guinness-gold/30 px-3 py-2 text-xs font-semibold text-guinness-tan hover:bg-guinness-brown/50 sm:w-auto sm:py-1.5"
                                >
                                  {t("pages.competitions.leave")}
                                </button>
                              ) : isPastTab ? (
                                <span className="type-meta w-full py-2 text-center text-guinness-tan/50 sm:text-right">
                                  {t("pages.competitions.closed")}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={full}
                                  onClick={() => void handleJoin(c.id)}
                                  className="w-full rounded-lg bg-guinness-gold/15 px-3 py-2 text-xs font-semibold text-guinness-gold hover:bg-guinness-gold/25 disabled:opacity-40 sm:w-auto sm:py-1.5"
                                >
                                  {full
                                    ? t("pages.competitions.full")
                                    : t("pages.competitions.join")}
                                </button>
                              )
                            ) : isPastTab ? null : (
                              <p className="type-meta w-full text-center text-guinness-tan/55 sm:text-left">
                                {t("pages.competitions.signInToJoinShort")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-guinness-gold/10 pt-3">
                          <div className="flex min-w-[6.5rem] flex-1 flex-col rounded-xl border border-guinness-gold/10 bg-guinness-black/30 px-3 py-2.5">
                            <span className="type-meta block text-guinness-tan/60">
                              {t("pages.competitions.statJoined")}
                            </span>
                            <span className="mt-1 text-base font-semibold text-guinness-gold">
                              {count}{" "}
                              <span className="text-guinness-tan/50">/</span>{" "}
                              {c.max_participants}
                            </span>
                          </div>
                          <div className="flex min-w-[6.5rem] flex-1 flex-col rounded-xl border border-guinness-gold/10 bg-guinness-black/30 px-3 py-2.5">
                            <span className="type-meta block text-guinness-tan/60">
                              {t("pages.competitions.statGlassesEach")}
                            </span>
                            <span className="mt-1 text-base font-semibold text-guinness-cream">
                              {c.glasses_per_person}
                            </span>
                          </div>
                          <div className="flex min-w-[min(100%,10rem)] flex-[2] flex-col rounded-xl border border-guinness-gold/10 bg-guinness-black/30 px-3 py-2.5 sm:flex-1">
                            <span className="type-meta block text-guinness-tan/60">
                              {t("pages.competitions.statRule")}
                            </span>
                            <span className="mt-1 block text-sm font-semibold leading-snug text-guinness-cream">
                              {winRuleLabelI18n(c.win_rule)}
                              {c.win_rule === "closest_to_target" &&
                              c.target_score != null
                                ? ` · ${Number(c.target_score).toFixed(2)}`
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isOwner && !isPastTab ? (
                        <details className="group border-t border-guinness-gold/10 bg-guinness-black/20">
                          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-guinness-gold transition-colors hover:bg-guinness-brown/30 sm:px-5 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center justify-between gap-2">
                              <span>
                                {t("pages.competitions.invitesFriendsSection")}
                              </span>
                              <span className="text-guinness-tan/50 transition-transform group-open:rotate-180">
                                ⌄
                              </span>
                            </span>
                          </summary>
                          <div className="space-y-4 border-t border-guinness-gold/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                            <div>
                              <p className="type-label text-guinness-tan/85">
                                {t("pages.competitions.inviteByEmail")}
                              </p>
                              <p className="type-meta mt-1 text-guinness-tan/60">
                                {t("pages.competitions.inviteByEmailHint")}
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
                                <input
                                  type="email"
                                  value={inviteInputs[c.id] ?? ""}
                                  onChange={(e) =>
                                    setInviteInputs((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={t(
                                    "pages.competitions.invitePlaceholder",
                                  )}
                                  className={fieldClass}
                                />
                                <button
                                  type="button"
                                  disabled={inviteBusy === c.id}
                                  onClick={() => void addEmailInvite(c.id)}
                                  className="min-h-11 rounded-lg bg-guinness-gold/20 px-4 py-2 text-xs font-semibold text-guinness-gold hover:bg-guinness-gold/30 disabled:opacity-50 sm:min-w-[8.5rem]"
                                >
                                  {t("pages.competitions.sendInvite")}
                                </button>
                              </div>
                              {invites.length > 0 ? (
                                <ul className="mt-3 space-y-2 rounded-lg border border-guinness-gold/10 bg-guinness-black/25 px-3 py-2 text-xs text-guinness-tan/80">
                                  {invites.map((inv) => (
                                    <li
                                      key={inv.id}
                                      className="flex items-center justify-between gap-2 py-0.5"
                                    >
                                      <span className="min-w-0 truncate">
                                        {inv.invited_email}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void removeInvite(c.id, inv.id)
                                        }
                                        className="shrink-0 text-red-400/90 hover:underline"
                                      >
                                        {t("pages.competitions.remove")}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>

                            {myFriends.length > 0 ? (
                              <div className="border-t border-guinness-gold/10 pt-4">
                                <p className="type-label text-guinness-tan/85">
                                  {t("pages.competitions.addFriendsTitle")}
                                </p>
                                <p className="type-meta mt-1 text-guinness-tan/60">
                                  {t("pages.competitions.addFriendsHint")}
                                </p>
                                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {myFriends.map((f) => (
                                    <li
                                      key={f.friend_user_id}
                                      className="flex flex-col gap-2 rounded-lg border border-guinness-gold/10 bg-guinness-black/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <span className="min-w-0 truncate text-sm text-guinness-cream">
                                        {f.peer_email ||
                                          f.friend_user_id.slice(0, 8) + "…"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void addFriendParticipant(
                                            c.id,
                                            f.friend_user_id,
                                          )
                                        }
                                        className={`${outlineBtn} shrink-0 self-start sm:self-auto`}
                                      >
                                        {t("pages.competitions.addToComp")}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <BrandedToast
        open={toastOpen}
        message={toastMessage}
        variant={toastVariant}
        title={
          formError && !uiToast ? t("toasts.toastDangerTitle") : undefined
        }
        onClose={() => {
          setFormError(null);
          setUiToast(null);
        }}
        autoCloseMs={toastAuto}
      />

      <BrandedNotice
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget
            ? t("pages.competitions.deleteConfirmNamed", {
                title: deleteTarget.title,
              })
            : t("pages.competitions.deleteConfirmGeneric")
        }
        description={t("pages.competitions.deleteDescription")}
        variant="danger"
        secondaryLabel={t("pages.competitions.keepCompetition")}
        primaryLabel={t("pages.competitions.deleteCompetition")}
        onPrimary={() => void confirmDeleteCompetition()}
      />
    </main>
  );
}
