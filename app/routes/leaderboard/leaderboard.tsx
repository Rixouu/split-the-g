import { type LoaderFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  standardPageDescription,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";
import { SubmissionsButton } from "~/components/leaderboard/SubmissionsButton";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_LEADERBOARD_COLUMNS } from "~/utils/scoresListColumns";

type LeaderboardEntry = {
  id: string;
  slug?: string | null;
  username: string;
  split_score: number;
  created_at: string;
  split_image_url: string;
};

export const loader: LoaderFunction = async () => {
  // Calculate date 7 days ago
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("scores")
    .select(SCORES_LEADERBOARD_COLUMNS)
    .gte("created_at", oneWeekAgo.toISOString())
    .order("split_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) throw error;

  return { entries: data };
};

export default function Leaderboard() {
  const { entries } = useLoaderData<{ entries: LeaderboardEntry[] }>();

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title="Top splits this week" description={standardPageDescription}>
          <SubmissionsButton />
        </PageHeader>

        <div className="w-full">
          {entries.map((entry, index) => (
            <Link
              key={entry.id}
              to={scorePourPathFromFields(entry)}
              className="mb-4 block rounded-2xl border border-guinness-gold/15 bg-guinness-brown/35 p-4 transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/50 sm:p-5"
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
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-guinness-cream sm:text-2xl">
                        {entry.username}
                      </p>
                      <p className="type-meta text-guinness-tan/70">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-3xl font-bold tabular-nums text-guinness-gold">
                        {entry.split_score.toFixed(2)}
                      </p>
                      <p className="type-meta text-guinness-tan/60">out of 5.0</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link to="/" className={pageHeaderActionButtonClass}>
            Back to Split
          </Link>
        </div>
      </div>
    </main>
  );
}
