import { useCallback, useEffect, useState } from "react";
import { AppLink } from "~/i18n/app-link";
import { useI18n } from "~/i18n/context";
import type { FriendRequestRow } from "~/routes/profile/profile-shared";
import { normalizeEmail } from "~/routes/profile/profile-shared";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { pubDetailPath } from "~/utils/pubPath";
import type { User } from "@supabase/supabase-js";

const RAIL_STROKE = "border-[#322914]";

interface FeedPourRow {
  id: string;
  slug?: string | null;
  username: string;
  pint_image_url: string;
  created_at: string;
  split_score: number;
  bar_name?: string | null;
  email?: string | null;
}

const FRIEND_POUR_SELECT_COLUMNS =
  "id, slug, username, pint_image_url, created_at, split_score, bar_name, email";

export function FeedSocialRail() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [incoming, setIncoming] = useState<FriendRequestRow[]>([]);
  const [friendPours, setFriendPours] = useState<FeedPourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState(0);

  const load = useCallback(async (u: User | null) => {
    if (!u?.email) {
      setIncoming([]);
      setFriendPours([]);
      setFriendCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = await getSupabaseBrowserClient();
    const uid = u.id;
    const emailNorm = normalizeEmail(u.email);

    const [{ data: inc }, { data: fr }] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("id, from_user_id, to_email, from_email, status, created_at")
        .eq("to_email", emailNorm)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("user_friends")
        .select("user_id, friend_user_id, peer_email, created_at")
        .eq("user_id", uid),
    ]);

    setIncoming((inc ?? []).filter((r) => (r as FriendRequestRow).from_user_id !== uid) as FriendRequestRow[]);

    const friendEmails = Array.from(
      new Set(
        (fr ?? [])
          .map((r) => normalizeEmail((r as { peer_email?: string | null }).peer_email ?? ""))
          .filter((e) => e.length > 0),
      ),
    );
    setFriendCount(friendEmails.length);

    if (friendEmails.length === 0) {
      setFriendPours([]);
      setLoading(false);
      return;
    }

    const { data: scoreRows } = await supabase
      .from("scores")
      .select(FRIEND_POUR_SELECT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(80);

    const emailSet = new Set(friendEmails);
    const matched = (scoreRows ?? []).filter((row) => {
      const em = (row as { email?: string | null }).email;
      return em && typeof em === "string" && emailSet.has(normalizeEmail(em));
    }) as FeedPourRow[];

    matched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFriendPours(matched.slice(0, 12));
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      const u = session?.user ?? null;
      setUser(u);
      await load(u);
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        if (!alive) return;
        const next = s?.user ?? null;
        setUser(next);
        void load(next);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();
    return () => { alive = false; unsubscribe?.(); };
  }, [load]);

  async function respondRequest(row: FriendRequestRow, status: "accepted" | "declined") {
    if (!user) return;
    setBusyId(row.id);
    setToast(null);
    try {
      const supabase = await getSupabaseBrowserClient();
      await supabase.from("friend_requests").update({ status }).eq("id", row.id);
      if (status === "accepted") {
        const pair = [
          { user_id: row.from_user_id, friend_user_id: user.id, peer_email: user.email ?? null },
          { user_id: user.id, friend_user_id: row.from_user_id, peer_email: row.from_email ?? null },
        ] as const;
        for (const r of pair) {
          await supabase.from("user_friends").upsert(r, { onConflict: "user_id,friend_user_id", ignoreDuplicates: true });
        }
        setToast(t("pages.profile.msgFriendAccepted"));
      } else {
        setToast(t("pages.profile.msgFriendDeclined"));
      }
      await load(user);
    } finally {
      setBusyId(null);
    }
  }

  if (!user?.email) {
    return (
      <p className="type-meta">
        {t("pages.feed.socialSignInHint")}{" "}
        <AppLink to="/profile/account" viewTransition className="font-semibold text-guinness-gold hover:text-guinness-tan">
          {t("pages.feed.socialSignInLink")}
        </AppLink>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <p className={`rounded-xl border ${RAIL_STROKE} bg-guinness-gold/10 px-3 py-2 text-sm text-guinness-cream`}>
          {toast}
        </p>
      ) : null}

      {incoming.length > 0 ? (
        <div>
          <h3 className="type-label mb-2 text-guinness-gold">
            {t("pages.feed.friendRequestsTitle")}
          </h3>
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li key={r.id} className={`rounded-xl border ${RAIL_STROKE} bg-guinness-black/30 p-3`}>
                <p className="text-[13px] text-guinness-cream">{r.from_email?.trim() || "—"}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void respondRequest(r, "accepted")}
                    className="rounded-lg bg-guinness-gold px-3 py-1 text-[11px] font-semibold text-guinness-black disabled:opacity-50"
                  >
                    {t("pages.profile.friendsAccept")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void respondRequest(r, "declined")}
                    className={`rounded-lg border ${RAIL_STROKE} bg-guinness-black/40 px-3 py-1 text-[11px] font-semibold text-guinness-tan/80 disabled:opacity-50`}
                  >
                    {t("pages.profile.friendsDecline")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {friendPours.length > 0 ? (
        <div>
          <h3 className="type-label mb-2 text-guinness-gold">
            {t("pages.feed.friendsPoursTitle")}
          </h3>
          <ul className="space-y-2">
            {friendPours.map((row) => {
              const bk = row.bar_name?.trim().toLowerCase() || null;
              return (
                <li key={row.id}>
                  <AppLink
                    to={scorePourPathFromFields(row)}
                    prefetch="intent"
                    viewTransition
                    className={`group flex gap-3 rounded-xl border ${RAIL_STROKE} bg-guinness-black/30 p-2 transition-colors hover:border-guinness-gold/25 hover:bg-guinness-brown/30`}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-guinness-brown/30">
                      {row.pint_image_url ? (
                        <img src={row.pint_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="truncate text-[13px] font-semibold text-guinness-cream">{row.username}</span>
                        <span className="shrink-0 text-[13px] font-bold tabular-nums text-guinness-gold">
                          {Number(row.split_score).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-guinness-tan/55">
                        {new Date(row.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {row.bar_name && bk ? (
                        <AppLink
                          to={pubDetailPath(bk)}
                          prefetch="intent"
                          viewTransition
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 line-clamp-1 text-[11px] text-guinness-gold/80 hover:underline"
                        >
                          {row.bar_name}
                        </AppLink>
                      ) : null}
                    </div>
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </div>
      ) : !loading && friendCount === 0 ? (
        <p className="type-meta">
          {t("pages.feed.socialQuiet")}{" "}
          <AppLink to="/profile/friends" viewTransition className="font-medium text-guinness-gold/80 hover:text-guinness-tan">
            {t("pages.feed.socialFriendsLink")}
          </AppLink>
        </p>
      ) : !loading && friendCount > 0 ? (
        <p className="type-meta">{t("pages.feed.friendsPoursEmpty")}</p>
      ) : null}
    </div>
  );
}
