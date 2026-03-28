import { scorePourPathFromFields } from "~/utils/scorePath";

export const COMPETITION_SCORE_LIMIT = 250;

/** Values from `competitions.win_rule` — extra strings fall through to highest-score behavior. */
export type CompetitionWinRule = string;

export type ScoreSnippet = {
  id: string;
  slug?: string | null;
  username: string | null;
  split_score: number;
  created_at: string;
  email?: string | null;
  country_code?: string | null;
  split_image_url?: string | null;
};

export type CompetitionScoreJoin = {
  id: string;
  user_id: string | null;
  score_id: string;
  created_at: string;
  scores: ScoreSnippet | ScoreSnippet[] | null;
};

export type PourEntry = {
  value: number;
  at: number;
  scoreId: string;
  slug: string | null;
  countryCode: string | null;
  createdAt: string;
  splitImageUrl: string | null;
};

export type RankedRow = {
  rank: number;
  userId: string;
  username: string;
  metric: string;
  detail: string;
  pourPath: string;
  countryCode: string | null;
  representativeCreatedAt: string;
  splitImageUrl: string | null;
};

export function unwrapScore(
  s: ScoreSnippet | ScoreSnippet[] | null | undefined,
): ScoreSnippet | null {
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function pickRepresentativePour(pours: PourEntry[]): PourEntry {
  let best = pours[0];
  for (const p of pours) {
    if (
      p.value > best.value ||
      (p.value === best.value && p.at < best.at)
    ) {
      best = p;
    }
  }
  return best;
}

export function buildLeaderboard(
  rows: CompetitionScoreJoin[],
  winRule: CompetitionWinRule,
  targetScore: number | null,
): RankedRow[] {
  type Agg = {
    userId: string;
    username: string;
    pours: PourEntry[];
  };
  const map = new Map<string, Agg>();

  for (const row of rows) {
    const scoreRow = unwrapScore(row.scores);
    if (!scoreRow) continue;
    const uid = row.user_id ?? "";
    if (!uid) continue;
    const prev = map.get(uid);
    const username = scoreRow.username?.trim() || "Player";
    const value = Number(scoreRow.split_score);
    const at = new Date(scoreRow.created_at).getTime();
    const cc = scoreRow.country_code?.trim().toUpperCase() ?? null;
    const pour: PourEntry = {
      value,
      at,
      scoreId: row.score_id,
      slug: scoreRow.slug ?? null,
      countryCode: cc && /^[A-Z]{2}$/.test(cc) ? cc : null,
      createdAt: scoreRow.created_at,
      splitImageUrl: scoreRow.split_image_url?.trim() || null,
    };
    if (!prev) {
      map.set(uid, {
        userId: uid,
        username,
        pours: [pour],
      });
    } else {
      prev.pours.push(pour);
    }
  }

  const list = [...map.values()];

  if (winRule === "most_submissions") {
    return list
      .map((a) => {
        const bestVal = Math.max(...a.pours.map((x) => x.value));
        const linkPour = pickRepresentativePour(a.pours);
        return {
          userId: a.userId,
          username: a.username,
          sortKey: a.pours.length,
          tie: bestVal,
          metric: `${a.pours.length} pour(s)`,
          detail: `Best ${bestVal.toFixed(2)} / 5`,
          pourPath: scorePourPathFromFields({
            id: linkPour.scoreId,
            slug: linkPour.slug,
          }),
          countryCode: linkPour.countryCode,
          representativeCreatedAt: linkPour.createdAt,
          splitImageUrl: linkPour.splitImageUrl,
        };
      })
      .sort((x, y) =>
        y.sortKey !== x.sortKey
          ? y.sortKey - x.sortKey
          : y.tie !== x.tie
            ? y.tie - x.tie
            : x.username.localeCompare(y.username),
      )
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        metric: r.metric,
        detail: r.detail,
        pourPath: r.pourPath,
        countryCode: r.countryCode,
        representativeCreatedAt: r.representativeCreatedAt,
        splitImageUrl: r.splitImageUrl,
      }));
  }

  if (
    winRule === "closest_to_target" &&
    targetScore != null &&
    Number.isFinite(targetScore)
  ) {
    return list
      .map((a) => {
        let bestDist = Infinity;
        let bestScore = 0;
        let bestAt = Infinity;
        let linkPour = a.pours[0];
        for (const s of a.pours) {
          const d = Math.abs(s.value - targetScore);
          if (
            d < bestDist ||
            (d === bestDist && s.value > bestScore) ||
            (d === bestDist && s.value === bestScore && s.at < bestAt)
          ) {
            bestDist = d;
            bestScore = s.value;
            bestAt = s.at;
            linkPour = s;
          }
        }
        return {
          userId: a.userId,
          username: a.username,
          sortKey: bestDist,
          tie: -bestScore,
          tie2: bestAt,
          metric: `Δ ${bestDist.toFixed(2)} from ${targetScore.toFixed(2)}`,
          detail: `Score ${bestScore.toFixed(2)} / 5`,
          pourPath: scorePourPathFromFields({
            id: linkPour.scoreId,
            slug: linkPour.slug,
          }),
          countryCode: linkPour.countryCode,
          representativeCreatedAt: linkPour.createdAt,
          splitImageUrl: linkPour.splitImageUrl,
        };
      })
      .sort((x, y) =>
        x.sortKey !== y.sortKey
          ? x.sortKey - y.sortKey
          : x.tie !== y.tie
            ? x.tie - y.tie
            : x.tie2 - y.tie2,
      )
      .map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.username,
        metric: r.metric,
        detail: r.detail,
        pourPath: r.pourPath,
        countryCode: r.countryCode,
        representativeCreatedAt: r.representativeCreatedAt,
        splitImageUrl: r.splitImageUrl,
      }));
  }

  return list
    .map((a) => {
      const linkPour = pickRepresentativePour(a.pours);
      return {
        userId: a.userId,
        username: a.username,
        sortKey: linkPour.value,
        tie: linkPour.at,
        metric: `${linkPour.value.toFixed(2)} / 5`,
        detail: "Best pour",
        pourPath: scorePourPathFromFields({
          id: linkPour.scoreId,
          slug: linkPour.slug,
        }),
        countryCode: linkPour.countryCode,
        representativeCreatedAt: linkPour.createdAt,
        splitImageUrl: linkPour.splitImageUrl,
      };
    })
    .sort((x, y) =>
      y.sortKey !== x.sortKey
        ? y.sortKey - x.sortKey
        : x.tie - y.tie,
    )
    .map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      metric: r.metric,
      detail: r.detail,
      pourPath: r.pourPath,
      countryCode: r.countryCode,
      representativeCreatedAt: r.representativeCreatedAt,
      splitImageUrl: r.splitImageUrl,
    }));
}

/** Supabase nested select for competition_scores rows (same shape as competition detail). */
export const COMPETITION_SCORES_SELECT =
  "id, user_id, score_id, created_at, scores (id, slug, username, split_score, created_at, email, country_code, split_image_url)" as const;
