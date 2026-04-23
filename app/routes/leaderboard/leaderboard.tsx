import { type LoaderFunction, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigation } from "react-router";
import { AppLink } from "~/i18n/app-link";
import { useMemo } from "react";
import {
  PageHeader,
  homePourButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";
import { SubmissionsButton } from "~/components/leaderboard/SubmissionsButton";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_LEADERBOARD_COLUMNS } from "~/utils/scoresListColumns";
import { SegmentedTabs } from "~/components/ui/segmented-tabs";
import { normalizeEmail } from "~/routes/profile/profile-shared";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";

type LeaderboardEntry = {
  id: string;
  slug?: string | null;
  username: string;
  split_score: number;
  created_at: string;
  split_image_url: string;
  country_code?: string | null;
};

type LeaderboardTab = "global" | "local" | "friends";

function weekAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function mapRows(data: unknown): LeaderboardEntry[] {
  if (!Array.isArray(data)) return [];
  return data as LeaderboardEntry[];
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") as LeaderboardTab) || "global";
  const since = weekAgoIso();

  if (tab === "global") {
    const { data, error } = await supabase.rpc("leaderboard_scores_global", {
      p_since: since,
      p_limit: 15,
    });

    if (error) {
      const hint = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
      if (
        error.code === "42883" ||
        hint.includes("leaderboard_scores_global") ||
        hint.includes("function")
      ) {
        const fb = await supabase
          .from("scores")
          .select(SCORES_LEADERBOARD_COLUMNS)
          .gte("created_at", since)
          .order("split_score", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(15);
        if (fb.error) throw fb.error;
        return { entries: (fb.data ?? []) as LeaderboardEntry[], hintKey: null, hintText: null, tab };
      }
      throw error;
    }

    return { entries: (data ?? []) as LeaderboardEntry[], hintKey: null, hintText: null, tab };
  }

  const { getSupabaseAccessTokenFromRequestCookies, getSupabaseUserFromAccessToken } = await import("~/utils/pour-auth-claim.server");
  const token = getSupabaseAccessTokenFromRequestCookies(request);
  let user = null;
  if (token) {
    user = await getSupabaseUserFromAccessToken(token);
  }

  if (tab === "local") {
    if (!user) {
      return { entries: [], hintKey: "pages.leaderboard.hintLocalSignIn", hintText: null, tab };
    }

    const { data: prof, error: perr } = await supabase
      .from("public_profiles")
      .select("country_code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perr || !prof?.country_code?.trim()) {
      return { entries: [], hintKey: "pages.leaderboard.hintLocalNoCountry", hintText: null, tab };
    }

    const code = prof.country_code.trim().toUpperCase();
    const { data, error } = await supabase.rpc("leaderboard_scores_for_country", {
      p_country: code,
      p_since: since,
      p_limit: 15,
    });

    if (error) {
      if (error.message.includes("function") || error.code === "42883") {
        return { entries: [], hintKey: "pages.leaderboard.hintMigrationCountry", hintText: null, tab };
      }
      return { entries: [], hintKey: null, hintText: error.message, tab };
    }

    return { entries: mapRows(data), hintKey: null, hintText: null, tab };
  }

  if (tab === "friends") {
    if (!user?.email) {
      return { entries: [], hintKey: "pages.leaderboard.hintFriendsSignIn", hintText: null, tab };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const envUrl = (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) || import.meta.env.VITE_SUPABASE_URL || "";
    const envAnon = (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    
    const scopedClient = createClient(envUrl, envAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const uid = user.id;
    const { data: fr } = await scopedClient
      .from("user_friends")
      .select("user_id, friend_user_id, peer_email")
      .or(`user_id.eq.${uid},friend_user_id.eq.${uid}`);

    const emailSet = new Set<string>();
    emailSet.add(normalizeEmail(user.email));
    for (const row of fr ?? []) {
      const peer = row.peer_email?.trim();
      if (peer) emailSet.add(normalizeEmail(peer));
    }

    const emails = [...emailSet];
    const { data, error } = await supabase.rpc("leaderboard_scores_for_emails", {
      p_emails: emails,
      p_since: since,
      p_limit: 15,
    });

    if (error) {
      if (error.message.includes("function") || error.code === "42883") {
        return { entries: [], hintKey: "pages.leaderboard.hintMigrationEmails", hintText: null, tab };
      }
      return { entries: [], hintKey: null, hintText: error.message, tab };
    }

    return { 
      entries: mapRows(data), 
      hintKey: emails.length < 2 ? "pages.leaderboard.hintFriendsSolo" : null, 
      hintText: null, 
      tab 
    };
  }

  return { entries: [], hintKey: null, hintText: null, tab };
};

export function headers() {
  return {
    "Cache-Control": "private, no-store, must-revalidate",
  };
}

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/leaderboard", "leaderboard");
}

function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  const { t } = useI18n();
  if (entries.length === 0) {
    return (
      <p className="type-meta rounded-2xl border border-[#322914] bg-guinness-brown/30 p-8 text-center text-guinness-tan/70">
        {t("pages.leaderboard.empty")}
      </p>
    );
  }

  return (
    <div className="w-full">
      {entries.map((entry, index) => (
        <AppLink
          key={entry.id}
          to={scorePourPathFromFields(entry)}
          prefetch="intent"
          viewTransition
          className="mb-4 block rounded-2xl border border-[#322914] bg-guinness-brown/35 p-4 transition-colors hover:border-guinness-gold/30 hover:bg-guinness-brown/50 sm:p-5"
        >
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-guinness-gold/12 text-xl font-bold text-guinness-gold sm:h-14 sm:w-14 sm:text-2xl">
              #{index + 1}
            </div>

            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-guinness-black/50 sm:h-20 sm:w-20">
              <img
                src={entry.split_image_url}
                alt={t("pages.leaderboard.splitImageAlt", {
                  username: entry.username,
                })}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-guinness-cream sm:text-2xl">
                    {flagEmojiFromIso2(entry.country_code) ? (
                      <span
                        className="mr-1.5 inline-block shrink-0"
                        title={entry.country_code?.trim().toUpperCase() ?? undefined}
                        aria-hidden
                      >
                        {flagEmojiFromIso2(entry.country_code)}
                      </span>
                    ) : null}
                    {entry.username}
                  </p>
                  <p className="type-meta text-guinness-tan/70">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold tabular-nums text-guinness-gold sm:text-3xl">
                    {Number(entry.split_score).toFixed(2)}
                  </p>
                  <p className="type-meta whitespace-nowrap text-guinness-tan/60">
                    {t("pages.leaderboard.outOfFive")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AppLink>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const { t } = useI18n();
  const { entries, hintKey, hintText, tab } = useLoaderData<{
    entries: LeaderboardEntry[];
    hintKey: string | null;
    hintText: string | null;
    tab: LeaderboardTab;
  }>();
  
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const loading = navigation.state === "loading" && navigation.location.pathname === "/leaderboard";

  const hint = hintKey ? t(hintKey) : hintText;

  const title = useMemo(() => {
    switch (tab) {
      case "local":
        return t("pages.leaderboard.titleLocalWeek");
      case "friends":
        return t("pages.leaderboard.titleFriendsWeek");
      default:
        return t("pages.leaderboard.titleGlobalWeek");
    }
  }, [tab, t]);

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={title}
          description={t("pages.descriptions.leaderboard")}
        >
          <SubmissionsButton />
        </PageHeader>

        <SegmentedTabs
          className="mb-6"
          layoutClassName="flex w-full"
          value={tab}
          onValueChange={(v) => setSearchParams({ tab: v }, { preventScrollReset: true })}
          items={[
            { value: "global", label: t("pages.leaderboard.tabGlobal") },
            { value: "local", label: t("pages.leaderboard.tabLocal") },
            { value: "friends", label: t("pages.leaderboard.tabFriends") },
          ]}
          aria-label={t("pages.leaderboard.scopeAria")}
          role="tablist"
          tabIdPrefix="leaderboard-tab"
          panelId="leaderboard-panel"
        />

        <div
          id="leaderboard-panel"
          role="tabpanel"
          aria-labelledby={`leaderboard-tab-${tab}`}
        >
          {hint ? (
            <p className="type-meta mb-4 rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 px-3 py-2 text-guinness-tan/85">
              {hint}
            </p>
          ) : null}

          {loading ? (
            <p className="type-meta text-guinness-tan/70">
              {t("pages.leaderboard.loading")}
            </p>
          ) : (
            <LeaderboardList entries={entries} />
          )}
        </div>

        <div className="mt-10 flex justify-center pb-6">
          <AppLink to="/" viewTransition className={homePourButtonClass}>
            {t("pages.leaderboard.newPour")}
          </AppLink>
        </div>
      </div>
    </main>
  );
}

