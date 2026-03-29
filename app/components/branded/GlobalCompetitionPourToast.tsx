import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { BrandedToast } from "./BrandedToast";
import { toastAutoCloseForVariant } from "./feedback-variant";

const TOAST_COOLDOWN_MS = 10_000;
const PHASE_POLL_MS = 25_000;
const META_REFRESH_MS = 120_000;

type CompTimeline = { title: string; starts_at: string; ends_at: string };
type Phase = "upcoming" | "live" | "ended";

function phaseAt(meta: CompTimeline, nowMs: number): Phase {
  const start = new Date(meta.starts_at).getTime();
  const end = new Date(meta.ends_at).getTime();
  if (nowMs < start) return "upcoming";
  if (nowMs < end) return "live";
  return "ended";
}

/**
 * App-wide competition notifications: realtime pour submissions (requires
 * `competition_scores` in `supabase_realtime`) and polling for start/end phase
 * changes on competitions you created or joined.
 */
export function GlobalCompetitionPourToast() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [toastVariant, setToastVariant] =
    useState<BrandedNoticeVariant>("info");

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  /** Competitions you care about for pour + phase toasts (participant or creator). */
  const relevantCompIdsRef = useRef<Set<string>>(new Set());
  const titleByCompRef = useRef<Map<string, string>>(new Map());
  const compTimelineRef = useRef<Map<string, CompTimeline>>(new Map());
  const phaseMapRef = useRef<Map<string, Phase>>(new Map());
  const userIdRef = useRef<string | null>(null);
  const lastToastByCompRef = useRef<Map<string, number>>(new Map());

  const showToast = useCallback(
    (text: string, variant: BrandedNoticeVariant) => {
      setMessage(text);
      setToastVariant(variant);
      setOpen(true);
    },
    [],
  );

  const getSupabase = useCallback(async () => {
    if (!supabaseRef.current) {
      supabaseRef.current = await getSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);

  const syncPhases = useCallback(
    (emitToasts: boolean) => {
      const now = Date.now();
      for (const [id, meta] of compTimelineRef.current) {
        const ph = phaseAt(meta, now);
        const prev = phaseMapRef.current.get(id);
        if (emitToasts && prev !== undefined && prev !== ph) {
          if (prev === "upcoming" && ph === "live") {
            showToast(`“${meta.title}” has started. Good luck.`, "success");
          } else if (prev === "live" && ph === "ended") {
            showToast(
              `“${meta.title}” has finished. Check the standings.`,
              "info",
            );
          } else if (prev === "upcoming" && ph === "ended") {
            showToast(`“${meta.title}” is no longer active.`, "info");
          }
        }
        phaseMapRef.current.set(id, ph);
      }
      for (const id of [...phaseMapRef.current.keys()]) {
        if (!compTimelineRef.current.has(id)) phaseMapRef.current.delete(id);
      }
    },
    [showToast],
  );

  const loadRelevantMeta = useCallback(async (uid: string) => {
    const supabase = await getSupabase();
    const [{ data: createdRows }, { data: parts }] = await Promise.all([
      supabase.from("competitions").select("id").eq("created_by", uid),
      supabase
        .from("competition_participants")
        .select("competition_id")
        .eq("user_id", uid),
    ]);

    const ids = new Set<string>();
    for (const c of createdRows ?? []) ids.add(String(c.id));
    for (const p of parts ?? []) ids.add(String(p.competition_id));

    relevantCompIdsRef.current = ids;
    titleByCompRef.current = new Map();
    compTimelineRef.current = new Map();

    if (ids.size === 0) return;

    const { data: comps } = await supabase
      .from("competitions")
      .select("id, title, starts_at, ends_at")
      .in("id", [...ids]);

    for (const row of comps ?? []) {
      const id = String(row.id);
      const title = String((row as { title?: string }).title ?? "Competition");
      const starts_at = String((row as { starts_at: string }).starts_at);
      const ends_at = String((row as { ends_at: string }).ends_at);
      titleByCompRef.current.set(id, title);
      compTimelineRef.current.set(id, { title, starts_at, ends_at });
    }
  }, [getSupabase]);

  const teardownChannel = useCallback(async () => {
    const ch = channelRef.current;
    channelRef.current = null;
    if (!ch) return;

    const supabase = await getSupabase();
    await supabase.removeChannel(ch);
  }, [getSupabase]);

  const onClose = useCallback(() => {
    setOpen(false);
    setMessage("");
  }, []);

  useEffect(() => {
    const phaseInterval = window.setInterval(() => {
      if (!userIdRef.current) return;
      syncPhases(true);
    }, PHASE_POLL_MS);

    return () => window.clearInterval(phaseInterval);
  }, [syncPhases]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function subscribe() {
      await teardownChannel();

      const supabase = await getSupabase();
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      userIdRef.current = uid;

      if (!uid) {
        relevantCompIdsRef.current = new Set();
        titleByCompRef.current = new Map();
        compTimelineRef.current = new Map();
        phaseMapRef.current = new Map();
        return;
      }

      await loadRelevantMeta(uid);
      if (cancelled) return;

      syncPhases(false);

      const channel = supabase
        .channel(`competition_pour_activity_${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "competition_scores",
          },
          (payload) => {
            const row = payload.new as {
              competition_id?: string;
              user_id?: string;
            };
            const compId = row.competition_id?.trim() ?? "";
            const pourUserId = row.user_id?.trim() ?? "";
            const me = userIdRef.current;
            if (!compId || !me || pourUserId === me) return;
            if (!relevantCompIdsRef.current.has(compId)) return;

            const now = Date.now();
            const last = lastToastByCompRef.current.get(compId) ?? 0;
            if (now - last < TOAST_COOLDOWN_MS) return;
            lastToastByCompRef.current.set(compId, now);

            const title = titleByCompRef.current.get(compId) ?? "your competition";
            showToast(
              `Someone submitted a new pour in “${title}”. Open Compete to see the leaderboard.`,
              "info",
            );
          },
        )
        .subscribe();

      channelRef.current = channel;
    }

    void subscribe();

    void getSupabase().then((supabase) => {
      if (cancelled) return;

      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        void subscribe();
      });

      unsubscribe = () => sub.subscription.unsubscribe();
    });

    const metaInterval = window.setInterval(() => {
      const me = userIdRef.current;
      if (me) {
        void loadRelevantMeta(me).then(() => {
          if (!cancelled && userIdRef.current) syncPhases(false);
        });
      }
    }, META_REFRESH_MS);

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.clearInterval(metaInterval);
      void teardownChannel();
    };
  }, [getSupabase, loadRelevantMeta, showToast, syncPhases, teardownChannel]);

  const toastTitle =
    toastVariant === "success"
      ? "Competition update"
      : toastVariant === "info"
        ? "Competition activity"
        : undefined;

  return (
    <BrandedToast
      open={open}
      message={message}
      variant={toastVariant}
      title={toastTitle}
      onClose={onClose}
      autoCloseMs={toastAutoCloseForVariant(toastVariant)}
    />
  );
}
