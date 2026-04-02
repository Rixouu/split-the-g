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

export type SegmentedTabTriggerLayout = "rowEqual" | "gridCell";

/**
 * Static trigger styles (no sliding indicator). Prefer SegmentedTabs for new UI.
 *
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

/**
 * Consecutive calendar days (local) with at least one pour, anchored from the most
 * recent pour day backward (streak breaks on first gap).
 */
export function pourStreakCalendarDays(scores: ScoreSummary[]): number {
  if (scores.length === 0) return 0;
  const dayKeys = new Set(
    scores.map((s) => {
      const d = new Date(s.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  const probe = new Date();
  probe.setHours(12, 0, 0, 0);
  const key = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (!dayKeys.has(key(probe))) {
    probe.setDate(probe.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    if (dayKeys.has(key(probe))) {
      streak++;
      probe.setDate(probe.getDate() - 1);
    } else break;
  }
  return streak;
}

/**
 * Consecutive ISO weeks (Mon–Sun) with at least one pour, anchored from the current
 * week’s Monday backward. Matches progress-page analytics.
 */
export function weeklyStreakFromScores(scores: ScoreSummary[]): number {
  if (scores.length === 0) return 0;
  const weekKeys = new Set(
    scores.map((s) => {
      const d = new Date(s.created_at);
      const day = d.getDay();
      const mondayShift = (day + 6) % 7;
      const monday = new Date(d);
      monday.setHours(12, 0, 0, 0);
      monday.setDate(monday.getDate() - mondayShift);
      return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
    }),
  );
  const probe = new Date();
  const day = probe.getDay();
  const mondayShift = (day + 6) % 7;
  probe.setHours(12, 0, 0, 0);
  probe.setDate(probe.getDate() - mondayShift);
  let streak = 0;
  for (let i = 0; i < 104; i++) {
    const key = `${probe.getFullYear()}-${probe.getMonth()}-${probe.getDate()}`;
    if (weekKeys.has(key)) {
      streak++;
      probe.setDate(probe.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Consecutive weeks with at least one pour on Sat/Sun (local), anchored from the
 * current week's Saturday backward. Matches progress-page achievement logic.
 */
export function weekendStreakFromScores(scores: ScoreSummary[]): number {
  if (scores.length === 0) return 0;
  const weekendKeys = new Set(
    scores
      .filter((s) => {
        const d = new Date(s.created_at).getDay();
        return d === 0 || d === 6;
      })
      .map((s) => {
        const d = new Date(s.created_at);
        const day = d.getDay();
        const saturdayShift = day === 0 ? 1 : day - 6;
        const saturday = new Date(d);
        saturday.setHours(12, 0, 0, 0);
        saturday.setDate(saturday.getDate() - saturdayShift);
        return `${saturday.getFullYear()}-${saturday.getMonth()}-${saturday.getDate()}`;
      }),
  );
  const probe = new Date();
  const pDay = probe.getDay();
  const saturdayShift = pDay === 0 ? 1 : pDay - 6;
  probe.setHours(12, 0, 0, 0);
  probe.setDate(probe.getDate() - saturdayShift);
  let streak = 0;
  for (let i = 0; i < 104; i++) {
    const key = `${probe.getFullYear()}-${probe.getMonth()}-${probe.getDate()}`;
    if (weekendKeys.has(key)) {
      streak++;
      probe.setDate(probe.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
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
