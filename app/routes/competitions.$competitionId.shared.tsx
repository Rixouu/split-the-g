import type { CompetitionRow } from "./competitions.shared";
import type { RankedRow } from "~/utils/competitionLeaderboard";

export type WinRule = CompetitionRow["win_rule"];

export interface ParticipantProfilePick {
  nickname?: string | null;
  display_name?: string | null;
  country_code?: string | null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function winRuleLabel(rule: string): string {
  switch (rule) {
    case "closest_to_target":
      return "Closest to target";
    case "most_submissions":
      return "Most submissions";
    case "lowest_score":
      return "Lowest split score";
    case "best_average":
      return "Best average score";
    case "highest_score":
    default:
      return "Highest score";
  }
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

export function competitionLeaderboardSecondaryMeta(
  r: RankedRow,
  winRule: WinRule,
): string | null {
  if (winRule === "closest_to_target") return r.metric;
  if (winRule === "most_submissions") return r.detail;
  if (winRule === "best_average") return r.detail;
  if (winRule === "lowest_score") return r.detail;
  return null;
}

export function CompetitionLeaderboardScoreAside({
  row,
  winRule,
}: {
  row: RankedRow;
  winRule: WinRule;
}) {
  if (winRule === "highest_score" || winRule === "lowest_score") {
    const m = row.metric.match(/^(\d+\.\d{2})\s*\/\s*5$/);
    const num = m ? m[1] : row.metric.replace(/\s*\/\s*5.*$/, "").trim() || "…";
    return (
      <div className="shrink-0 text-right">
        <p className="text-2xl font-bold tabular-nums text-guinness-gold sm:text-3xl">
          {num}
        </p>
        <p className="type-meta whitespace-nowrap text-guinness-tan/60">out of 5.0</p>
      </div>
    );
  }
  if (winRule === "best_average") {
    const m = row.metric.match(/^Avg\s+(\d+\.\d{2})/);
    const num = m ? m[1] : "…";
    return (
      <div className="shrink-0 text-right">
        <p className="text-2xl font-bold tabular-nums text-guinness-gold sm:text-3xl">
          {num}
        </p>
        <p className="type-meta whitespace-nowrap text-guinness-tan/60">avg / 5.0</p>
      </div>
    );
  }
  if (winRule === "closest_to_target") {
    const m = row.detail.match(/Score\s+(\d+\.\d{2})\s*\/\s*5/);
    const num = m ? m[1] : "…";
    return (
      <div className="shrink-0 text-right">
        <p className="text-2xl font-bold tabular-nums text-guinness-gold sm:text-3xl">
          {num}
        </p>
        <p className="type-meta whitespace-nowrap text-guinness-tan/60">out of 5.0</p>
      </div>
    );
  }
  const countMatch = row.metric.match(/^(\d+)\s+pour/);
  const count = countMatch ? countMatch[1] : row.metric;
  return (
    <div className="shrink-0 text-right">
      <p className="text-2xl font-bold tabular-nums text-guinness-gold sm:text-3xl">
        {count}
      </p>
      <p className="type-meta whitespace-nowrap text-guinness-tan/60">pours</p>
    </div>
  );
}

export function CrownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M5 16L3 7l5.5 3L12 4l3.5 6L21 7l-2 9H5zm1 2h12v2H6v-2z" />
    </svg>
  );
}
