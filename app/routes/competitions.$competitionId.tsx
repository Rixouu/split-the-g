import { Link, useLoaderData, useParams, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  standardPageDescription,
} from "~/components/PageHeader";
import { supabase } from "~/utils/supabase";
import { scorePourPathFromFields } from "~/utils/scorePath";
import type { CompetitionRow } from "~/routes/competitions";

type WinRule = CompetitionRow["win_rule"];

type ScoreSnippet = {
  id: string;
  slug?: string | null;
  username: string | null;
  split_score: number;
  created_at: string;
};

type CompetitionScoreJoin = {
  id: string;
  user_id: string | null;
  score_id: string;
  created_at: string;
  scores: ScoreSnippet | ScoreSnippet[] | null;
};

function unwrapScore(
  s: ScoreSnippet | ScoreSnippet[] | null | undefined,
): ScoreSnippet | null {
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function winRuleLabel(rule: string): string {
  switch (rule) {
    case "closest_to_target":
      return "Closest to target";
    case "most_submissions":
      return "Most submissions";
    case "highest_score":
    default:
      return "Highest score";
  }
}

function formatDuration(ms: number): string {
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

type PourEntry = {
  value: number;
  at: number;
  scoreId: string;
  slug: string | null;
};

type RankedRow = {
  rank: number;
  userId: string;
  username: string;
  metric: string;
  detail: string;
  pourPath: string;
};

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

function buildLeaderboard(
  rows: CompetitionScoreJoin[],
  winRule: WinRule,
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
    const pour: PourEntry = {
      value,
      at,
      scoreId: row.score_id,
      slug: scoreRow.slug ?? null,
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
      }));
  }

  if (winRule === "closest_to_target" && targetScore != null && Number.isFinite(targetScore)) {
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
      }));
  }

  // highest_score (default)
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
    }));
}

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.competitionId?.trim();
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return {
    competitionId: id,
    competition: (data ?? null) as CompetitionRow | null,
    loadError: error?.message ?? null,
  };
}

export default function CompetitionDetail() {
  const { competitionId, competition: loaderComp, loadError } =
    useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const params = useParams();

  const [competition, setCompetition] = useState<CompetitionRow | null>(
    loaderComp,
  );
  const [joined, setJoined] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [scoresJoined, setScoresJoined] = useState<CompetitionScoreJoin[]>([]);
  const [myScores, setMyScores] = useState<
    { id: string; split_score: number; created_at: string; bar_name: string | null }[]
  >([]);
  const [submittedScoreIds, setSubmittedScoreIds] = useState<Set<string>>(
    new Set(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshAll = useCallback(async () => {
    const id = competitionId;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    const em = auth.user?.email?.trim() ?? null;
    setUserId(uid);
    setUserEmail(em);

    const { data: compRows } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (compRows) setCompetition(compRows as CompetitionRow);

    if (uid) {
      const { data: part } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .eq("competition_id", id)
        .eq("user_id", uid)
        .maybeSingle();
      setJoined(Boolean(part));
    } else {
      setJoined(false);
    }

    const { data: csRows } = await supabase
      .from("competition_scores")
      .select(
        "id, user_id, score_id, created_at, scores (id, slug, username, split_score, created_at)",
      )
      .eq("competition_id", id);

    const list = (csRows ?? []) as CompetitionScoreJoin[];
    setScoresJoined(list);
    setSubmittedScoreIds(new Set(list.map((r) => r.score_id)));

    if (em) {
      const { data: mine } = await supabase
        .from("scores")
        .select("id, split_score, created_at, bar_name")
        .eq("email", em)
        .order("created_at", { ascending: false })
        .limit(40);
      setMyScores((mine ?? []) as typeof myScores);
    } else {
      setMyScores([]);
    }
  }, [competitionId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll, revalidator.state]);

  useEffect(() => {
    if (loaderComp) setCompetition(loaderComp);
  }, [loaderComp]);

  const ranked = useMemo(() => {
    if (!competition) return [];
    const target =
      competition.target_score != null
        ? Number(competition.target_score)
        : null;
    return buildLeaderboard(
      scoresJoined,
      competition.win_rule as WinRule,
      target,
    );
  }, [competition, scoresJoined]);

  const timePhase = useMemo(() => {
    if (!competition) return null;
    const now = Date.now();
    const start = new Date(competition.starts_at).getTime();
    const end = new Date(competition.ends_at).getTime();
    if (now < start) return { phase: "before" as const, ms: start - now };
    if (now > end) return { phase: "after" as const, ms: 0 };
    return { phase: "live" as const, ms: end - now };
  }, [competition, tick]);

  async function handleJoin() {
    setMessage(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setMessage("Sign in to join.");
      return;
    }
    const { error } = await supabase.from("competition_participants").insert({
      competition_id: competitionId,
      user_id: u.user.id,
    });
    if (error) setMessage(error.message);
    else {
      setJoined(true);
      revalidator.revalidate();
      void refreshAll();
    }
  }

  async function handleLeave() {
    setMessage(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("competition_participants")
      .delete()
      .eq("competition_id", competitionId)
      .eq("user_id", u.user.id);
    if (error) setMessage(error.message);
    else {
      setJoined(false);
      revalidator.revalidate();
      void refreshAll();
    }
  }

  async function submitScore(scoreId: string) {
    setMessage(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setMessage("Sign in to submit.");
      return;
    }
    setSubmitBusy(scoreId);
    const { error } = await supabase.from("competition_scores").insert({
      competition_id: competitionId,
      score_id: scoreId,
      user_id: u.user.id,
    });
    setSubmitBusy(null);
    if (error) setMessage(error.message);
    else {
      revalidator.revalidate();
      void refreshAll();
    }
  }

  if (!params.competitionId) {
    return null;
  }

  if (loadError && !competition) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-red-400/90">{loadError}</p>
          <Link to="/competitions" className="mt-4 inline-block text-guinness-gold underline">
            Back to competitions
          </Link>
        </div>
      </main>
    );
  }

  if (!competition) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-guinness-tan/70">Loading competition…</p>
        </div>
      </main>
    );
  }

  const isPrivate = (competition.visibility ?? "public") === "private";
  const canSubmit =
    joined &&
    timePhase?.phase === "live" &&
    userId;

  const availableToSubmit = myScores.filter(
    (s) => !submittedScoreIds.has(s.id),
  );

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader title={competition.title} description={standardPageDescription}>
          <Link to="/competitions" className={pageHeaderActionButtonClass}>
            All competitions
          </Link>
        </PageHeader>

        <div className="mb-6 rounded-2xl border border-guinness-gold/15 bg-guinness-brown/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-guinness-gold/10 pb-3 text-sm text-guinness-tan/80">
            <span className="font-semibold text-guinness-gold">
              {winRuleLabel(competition.win_rule)}
              {competition.win_rule === "closest_to_target" &&
              competition.target_score != null
                ? ` · target ${Number(competition.target_score).toFixed(2)}`
                : ""}
            </span>
            <span className="text-guinness-tan/50" aria-hidden>
              ·
            </span>
            <span>{isPrivate ? "Private" : "Public"}</span>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3">
              <dt className="type-meta text-guinness-tan/65">Status</dt>
              <dd className="mt-1 text-lg font-semibold text-guinness-gold">
                {timePhase?.phase === "before"
                  ? "Not started"
                  : timePhase?.phase === "live"
                    ? "Live"
                    : "Ended"}
              </dd>
            </div>
            <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3">
              <dt className="type-meta text-guinness-tan/65">
                {timePhase?.phase === "before"
                  ? "Starts in"
                  : timePhase?.phase === "live"
                    ? "Ends in"
                    : "Finished"}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream">
                {timePhase?.phase === "after"
                  ? "—"
                  : timePhase
                    ? formatDuration(timePhase.ms)
                    : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3 sm:col-span-2 lg:col-span-1">
              <dt className="type-meta text-guinness-tan/65">Window</dt>
              <dd className="mt-1 text-xs leading-relaxed text-guinness-tan/85">
                {new Date(competition.starts_at).toLocaleString()} →{" "}
                {new Date(competition.ends_at).toLocaleString()}
              </dd>
            </div>
            <div className="rounded-xl border border-guinness-gold/10 bg-guinness-black/25 px-3 py-3 sm:col-span-2 lg:col-span-1">
              <dt className="type-meta text-guinness-tan/65">Capacity</dt>
              <dd className="mt-1 text-base font-semibold leading-snug text-guinness-cream">
                Up to {competition.max_participants} people ·{" "}
                {competition.glasses_per_person} glass
                {competition.glasses_per_person === 1 ? "" : "es"} each
              </dd>
            </div>
          </dl>
        </div>

        {message ? (
          <p className="type-meta mb-4 text-red-400/90">{message}</p>
        ) : null}

        <div className="mb-8 flex w-full flex-wrap items-center justify-center gap-2">
          {!userId ? (
            <p className="type-meta text-guinness-tan/70">
              Sign in (Profile) to join or submit pours.
            </p>
          ) : joined ? (
            <>
              <button
                type="button"
                onClick={() => void handleLeave()}
                className="rounded-lg border border-guinness-gold/30 px-4 py-2 text-sm font-medium text-guinness-tan hover:bg-guinness-brown/50"
              >
                Leave competition
              </button>
              {canSubmit ? (
                <Link
                  to={`/?competition=${encodeURIComponent(competitionId)}`}
                  className={pageHeaderActionButtonClass}
                >
                  New pour for comp
                </Link>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleJoin()}
              className={pageHeaderActionButtonClass}
            >
              Join competition
            </button>
          )}
        </div>

        {joined && userEmail && timePhase?.phase === "live" ? (
          <section className="mb-10 rounded-2xl border border-guinness-gold/20 bg-guinness-brown/30 p-5">
            <h2 className="type-card-title mb-3">Submit an existing score</h2>
            <p className="type-meta mb-4 text-guinness-tan/75">
              Only scores claimed to your email can be submitted. Each score
              can only be used once in this competition.
            </p>
            {availableToSubmit.length === 0 ? (
              <p className="type-meta text-guinness-tan/60">
                No eligible scores left — pour a new one with the button above.
              </p>
            ) : (
              <ul className="space-y-2">
                {availableToSubmit.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-guinness-gold/15 bg-guinness-black/35 px-3 py-2"
                  >
                    <div>
                      <span className="font-semibold text-guinness-gold tabular-nums">
                        {s.split_score.toFixed(2)}
                      </span>
                      <span className="type-meta ml-2 text-guinness-tan/70">
                        {new Date(s.created_at).toLocaleDateString()}
                        {s.bar_name ? ` · ${s.bar_name}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={submitBusy === s.id}
                      onClick={() => void submitScore(s.id)}
                      className="rounded-lg bg-guinness-gold px-3 py-1.5 text-xs font-semibold text-guinness-black hover:bg-guinness-tan disabled:opacity-50"
                    >
                      {submitBusy === s.id ? "…" : "Submit"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="type-card-title mb-4">Leaderboard</h2>
          {ranked.length === 0 ? (
            <p className="type-meta text-guinness-tan/65">
              No submissions yet. Join and pour!
            </p>
          ) : (
            <ul className="space-y-2">
              {ranked.map((r) => (
                <li key={r.userId}>
                  <Link
                    to={r.pourPath}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-guinness-gold/15 bg-guinness-brown/35 px-4 py-3 transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinness-gold"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-8 shrink-0 text-lg font-bold text-guinness-gold">
                        #{r.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-guinness-cream">
                          {r.username}
                        </p>
                        <p className="type-meta text-guinness-tan/65">{r.detail}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <p className="text-sm font-semibold text-guinness-gold">
                        {r.metric}
                      </p>
                      <span
                        className="text-guinness-tan/45 text-xs"
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
