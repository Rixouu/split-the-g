export type ProgressRange = "7d" | "30d" | "90d" | "all";

export type ScoreSummary = {
  id: string;
  slug?: string | null;
  split_score: number;
  created_at: string;
  bar_name: string | null;
  pint_price?: number | null;
};

export type FavoriteRow = {
  id: string;
  bar_name: string;
  bar_address: string | null;
  created_at: string;
};

export type FavoriteBarStats = {
  avg: number;
  count: number;
};

export type FriendRequestRow = {
  id: string;
  from_user_id: string;
  to_email: string;
  from_email: string | null;
  status: string;
  created_at: string;
};

export type UserFriendRow = {
  user_id: string;
  friend_user_id: string;
  peer_email: string | null;
  created_at: string;
};

export type PublicProfileRow = {
  user_id: string;
  display_name: string | null;
  nickname?: string | null;
  /** ISO 3166-1 alpha-2 */
  country_code?: string | null;
};

export type ComparisonScoreRow = {
  email: string | null;
  username: string | null;
  split_score: number;
  created_at: string;
};

export type FriendLeaderboardEntry = {
  email: string;
  label: string;
  pours: number;
  avg: number;
  best: number;
  latestAt: string;
  isCurrentUser: boolean;
};

export const progressRangeOptions: { value: ProgressRange; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

/**
 * Shared chrome for segmented tabs (add `flex` or `grid` on the element).
 * Matches list/card treatment — no forced uppercase on labels.
 */
export const segmentedTabGroupChromeClass =
  "w-full gap-1 rounded-xl border border-[#322914] bg-guinness-brown/25 p-1 sm:p-1.5";

export type SegmentedTabTriggerLayout = "rowEqual" | "gridCell";

/**
 * @param layout rowEqual — flex row with equal-width segments (leaderboard scope, time range).
 *               gridCell — fills a grid cell (profile section nav).
 */
export function segmentedTabTriggerClass(
  active: boolean,
  layout: SegmentedTabTriggerLayout = "rowEqual",
): string {
  const shell =
    layout === "rowEqual"
      ? "flex min-h-11 flex-1 basis-0 min-w-0 items-center justify-center"
      : "flex min-h-11 w-full min-w-0 items-center justify-center";
  const base =
    "rounded-lg px-1.5 py-2 text-center text-sm font-semibold leading-tight tracking-normal transition-colors sm:px-2.5";
  const state = active
    ? "bg-guinness-gold text-guinness-black shadow-sm"
    : "text-guinness-tan/75 hover:bg-guinness-black/30 hover:text-guinness-cream";
  return `${shell} ${base} ${state}`;
}

export function favoriteMapsUrl(f: FavoriteRow): string {
  const q = [f.bar_name, f.bar_address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function barKey(name: string, address?: string | null): string {
  return `${name.trim().toLowerCase()}::${(address ?? "").trim().toLowerCase()}`;
}

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function emailDisplayName(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

/** PostgREST `ilike` treats `%` and `_` as wildcards; escape for literal email match. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function progressRangeStart(range: ProgressRange): number | null {
  const now = Date.now();
  switch (range) {
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return now - 90 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function buildFriendLeaderboard(
  rows: ComparisonScoreRow[],
  labels: Record<string, string>,
  currentEmail: string | null,
): FriendLeaderboardEntry[] {
  const grouped = new Map<
    string,
    {
      total: number;
      count: number;
      best: number;
      latestAt: string;
      latestName: string | null;
    }
  >();

  for (const row of rows) {
    const rawEmail = row.email?.trim();
    if (!rawEmail) continue;
    const email = normalizeEmail(rawEmail);
    const current = grouped.get(email) ?? {
      total: 0,
      count: 0,
      best: 0,
      latestAt: "",
      latestName: null,
    };

    current.total += Number(row.split_score ?? 0);
    current.count += 1;
    current.best = Math.max(current.best, Number(row.split_score ?? 0));
    if (!current.latestAt || new Date(row.created_at) > new Date(current.latestAt)) {
      current.latestAt = row.created_at;
      current.latestName = row.username?.trim() || null;
    }
    grouped.set(email, current);
  }

  return [...grouped.entries()]
    .map(([email, entry]) => ({
      email,
      label: labels[email] || entry.latestName || emailDisplayName(email),
      pours: entry.count,
      avg: entry.total / entry.count,
      best: entry.best,
      latestAt: entry.latestAt,
      isCurrentUser: currentEmail != null && normalizeEmail(currentEmail) === email,
    }))
    .sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.best !== a.best) return b.best - a.best;
      if (b.pours !== a.pours) return b.pours - a.pours;
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });
}
