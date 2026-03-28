import { type LoaderFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  leaderboardPageDescription,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";
import { SubmissionsButton } from "~/components/leaderboard/SubmissionsButton";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_LEADERBOARD_COLUMNS } from "~/utils/scoresListColumns";
import { normalizeEmail } from "~/routes/profile/profile-shared";

type LeaderboardEntry = {
  id: string;
  slug?: string | null;
  username: string;
  split_score: number;
  created_at: string;
  split_image_url: string;
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

export const loader: LoaderFunction = async () => {
  const since = weekAgoIso();
  const { data, error } = await supabase
    .from("scores")
    .select(SCORES_LEADERBOARD_COLUMNS)
    .gte("created_at", since)
    .order("split_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) throw error;

  return { entries: (data ?? []) as LeaderboardEntry[] };
};

const tabButton = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:px-4 sm:text-sm ${
    active
      ? "bg-guinness-gold text-guinness-black"
      : "border border-guinness-gold/25 text-guinness-tan/80 hover:border-guinness-gold/40 hover:text-guinness-cream"
  }`;

function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="type-meta rounded-2xl border border-[#322914] bg-guinness-brown/30 p-8 text-center text-guinness-tan/70">
        No pours in this view for the last 7 days yet.
      </p>
    );
  }

  return (
    <div className="w-full">
      {entries.map((entry, index) => (
        <Link
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
                alt={`Split by ${entry.username}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-guinness-cream sm:text-2xl">
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
                    out of 5.0
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const { entries: globalFromLoader } = useLoaderData<{
    entries: LeaderboardEntry[];
  }>();
  const [tab, setTab] = useState<LeaderboardTab>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(globalFromLoader);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "global") {
      setEntries(globalFromLoader);
      setHint(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setHint(null);

    void (async () => {
      const since = weekAgoIso();

      if (tab === "local") {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          if (!cancelled) {
            setEntries([]);
            setHint(
              "Sign in and set your country on Profile to see pours from that country.",
            );
          }
          setLoading(false);
          return;
        }

        const { data: prof, error: perr } = await supabase
          .from("public_profiles")
          .select("country_code")
          .eq("user_id", uid)
          .maybeSingle();

        if (perr || !prof?.country_code?.trim()) {
          if (!cancelled) {
            setEntries([]);
            setHint(
              "Add your country under Profile — Local shows top pours this week where the pour’s location matches that country.",
            );
          }
          setLoading(false);
          return;
        }

        const code = prof.country_code.trim().toUpperCase();
        const { data, error } = await supabase.rpc("leaderboard_scores_for_country", {
          p_country: code,
          p_since: since,
          p_limit: 15,
        });

        if (error) {
          if (!cancelled) {
            setEntries([]);
            setHint(
              error.message.includes("function") || error.code === "42883"
                ? "Run the latest Supabase migration (leaderboard_scores_for_country)."
                : error.message,
            );
          }
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setEntries(mapRows(data));
          setHint(null);
        }
        setLoading(false);
        return;
      }

      if (tab === "friends") {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user?.email) {
          if (!cancelled) {
            setEntries([]);
            setHint("Sign in to see pours from you and your accepted friends.");
          }
          setLoading(false);
          return;
        }

        const uid = user.id;
        const { data: fr } = await supabase
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
          if (!cancelled) {
            setEntries([]);
            setHint(
              error.message.includes("function") || error.code === "42883"
                ? "Run the latest Supabase migration (leaderboard_scores_for_emails)."
                : error.message,
            );
          }
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setEntries(mapRows(data));
          if (emails.length < 2) {
            setHint(
              "Add friends from Profile to compare more pours here. Showing yours only until then.",
            );
          } else {
            setHint(null);
          }
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, globalFromLoader]);

  const title = useMemo(() => {
    switch (tab) {
      case "local":
        return "Local pours this week";
      case "friends":
        return "Friends & you this week";
      default:
        return "Top splits this week";
    }
  }, [tab]);

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title={title} description={leaderboardPageDescription}>
          <SubmissionsButton />
        </PageHeader>

        <div
          className="mb-6 flex flex-wrap gap-2 border-b border-[#322914] pb-4"
          role="tablist"
          aria-label="Leaderboard scope"
        >
          {(
            [
              ["global", "Global"],
              ["local", "Local"],
              ["friends", "Friends"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tabButton(tab === id)}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {hint ? (
          <p className="type-meta mb-4 rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 px-3 py-2 text-guinness-tan/85">
            {hint}
          </p>
        ) : null}

        {loading ? (
          <p className="type-meta text-guinness-tan/70">Loading…</p>
        ) : (
          <LeaderboardList entries={entries} />
        )}

        <div className="mt-8 flex justify-center">
          <Link to="/" viewTransition className={pageHeaderActionButtonClass}>
            Back to Split
          </Link>
        </div>
      </div>
    </main>
  );
}
