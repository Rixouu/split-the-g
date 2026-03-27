import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  PageHeader,
  feedPageDescription,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { SCORES_LIST_COLUMNS } from "~/utils/scoresListColumns";

type FeedRow = {
  id: string;
  slug?: string | null;
  username: string;
  pint_image_url: string;
  created_at: string;
  split_score: number;
  bar_name?: string | null;
  bar_address?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
};

export async function loader(_args: LoaderFunctionArgs) {
  const { data, error } = await supabase
    .from("scores")
    .select(SCORES_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(48);

  if (error) throw error;

  return { items: (data ?? []) as FeedRow[] };
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Feed() {
  const { items } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title="Feed" description={feedPageDescription}>
          <Link to="/" viewTransition className={pageHeaderActionButtonClass}>
            New pour
          </Link>
        </PageHeader>

        {items.length === 0 ? (
          <p className="type-meta rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-8 text-center text-guinness-tan/80">
            No submissions yet. Be the first on the home screen.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((row) => (
              <li key={row.id} className="min-w-0">
                <Link
                  to={scorePourPathFromFields(row)}
                  prefetch="intent"
                  viewTransition
                  className="group block overflow-hidden rounded-lg border border-guinness-gold/15 bg-guinness-brown/30 transition-colors hover:border-guinness-gold/35"
                >
                  <div className="aspect-[3/4] bg-guinness-black/60">
                    {row.pint_image_url ? (
                      <img
                        src={row.pint_image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-guinness-tan/50">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-2.5 sm:p-3">
                    <div className="flex items-start justify-between gap-1">
                      <span className="line-clamp-2 text-xs font-semibold text-guinness-cream sm:text-sm">
                        {row.username}
                      </span>
                      <span className="shrink-0 tabular-nums text-sm font-semibold text-guinness-gold">
                        {row.split_score.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-guinness-tan/55 sm:text-xs">
                      {formatWhen(row.created_at)}
                    </p>
                    {row.bar_name ? (
                      <p className="line-clamp-2 text-[10px] text-guinness-tan/45 sm:text-xs">
                        {row.bar_name}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
