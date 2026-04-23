import { redirect, type LoaderFunctionArgs } from "react-router";
import { langFromParams } from "~/i18n/lang-param";
import { localizePath } from "~/i18n/paths";
import type { PubWallRow } from "~/components/pub/PubWallTab";
import type { BarStat } from "~/routes/pubs";
import {
  fetchPlaceOpeningHoursWeekdayLines,
  resolveGoogleMapsKeyForServer,
} from "~/utils/googlePlaceDetails";
import {
  barKeyToPubPathSegment,
  decodePubUrlSegment,
  isPrettyPubPathSegment,
  pubDetailPath,
  resolveBarKeyFromPubPathSegment,
} from "~/utils/pubPath";
import { supabase } from "~/utils/supabase";
import {
  numFromDb,
  PUB_WALL_PAGE_LIMIT,
  type LinkedCompetition,
  type PubExtraRow,
  type PubPlaceRow,
} from "./pubs.$barKey.shared";

const barStatProjection =
  "bar_key, display_name, sample_address, google_place_id, avg_pour_rating, rating_count, submission_count";

function loadDeferredGoogleOpeningHours(
  resolvedPlaceId: string | null,
): Promise<string[] | null> {
  if (!resolvedPlaceId) return Promise.resolve(null);

  const mapsKey = resolveGoogleMapsKeyForServer();
  if (!mapsKey) return Promise.resolve(null);

  return Promise.race([
    fetchPlaceOpeningHoursWeekdayLines(resolvedPlaceId, mapsKey),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1500);
    }),
  ]).catch(() => null);
}

/**
 * Resolve the user's auth + favorites in a single async branch.
 * This runs concurrently with the main data queries.
 */
async function resolveUserAndFavorites(
  request: Request,
  barKey: string,
): Promise<{ userId: string | null; userEmail: string | null; favId: string | null }> {
  const {
    getSupabaseAccessTokenFromRequestCookies,
    getSupabaseUserFromAccessToken,
  } = await import("~/utils/pour-auth-claim.server");
  const token = getSupabaseAccessTokenFromRequestCookies(request);
  if (!token) return { userId: null, userEmail: null, favId: null };

  const user = await getSupabaseUserFromAccessToken(token);
  if (!user) return { userId: null, userEmail: null, favId: null };

  const { createClient } = await import("@supabase/supabase-js");
  const envUrl =
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
    import.meta.env.VITE_SUPABASE_URL ||
    "";
  const envAnon =
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "";
  const scopedClient = createClient(envUrl, envAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: favs } = await scopedClient
    .from("user_favorite_bars")
    .select("id, bar_name")
    .eq("user_id", user.id);

  const match = (favs ?? []).find(
    (r) => r.bar_name.trim().toLowerCase() === barKey,
  );

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    favId: match?.id ?? null,
  };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const lang = langFromParams(params);
  const raw = params.barKey?.trim();
  if (!raw) throw new Response("Not found", { status: 404 });

  const barKey = await resolveBarKeyFromPubPathSegment(supabase, raw);
  if (!barKey) throw new Response("Not found", { status: 404 });

  const prettySeg = barKeyToPubPathSegment(barKey);
  if (isPrettyPubPathSegment(prettySeg)) {
    const incoming = decodePubUrlSegment(raw).trim().toLowerCase();
    if (incoming !== prettySeg) {
      return redirect(localizePath(pubDetailPath(barKey), lang), {
        status: 301,
      });
    }
  }

  // ── Fire stat query + all secondary data + auth in ONE parallel batch ──
  let statQuery = await supabase
    .from("bar_pub_stats_mv")
    .select(barStatProjection)
    .eq("bar_key", barKey)
    .maybeSingle();
  if (statQuery.error || !statQuery.data) {
    statQuery = await supabase
      .from("bar_pub_stats")
      .select(barStatProjection)
      .eq("bar_key", barKey)
      .maybeSingle();
  }
  const { data: stat, error: statError } = statQuery;
  if (statError || !stat) throw new Response("Not found", { status: 404 });

  const bar = stat as BarStat;
  const nowIso = new Date().toISOString();

  // ── Run ALL remaining network calls in parallel ──
  // Previously auth ran AFTER these; now it runs concurrently.
  const [wallRes, extraRes, placeRes, compRes, authResult] =
    await Promise.all([
      supabase.rpc("pub_wall_scores", {
        p_bar_key: barKey,
        p_limit: PUB_WALL_PAGE_LIMIT,
      }),
      supabase.rpc("pub_extra_stats_for_bar", { p_bar_key: barKey }),
      supabase
        .from("pub_place_details")
        .select(
          "bar_key, opening_hours, guinness_info, alcohol_promotions, maps_place_url, google_place_id, updated_at, updated_by",
        )
        .eq("bar_key", barKey)
        .maybeSingle(),
      supabase
        .from("competitions")
        .select("id, title, starts_at, ends_at, path_segment")
        .eq("linked_bar_key", barKey)
        .gt("ends_at", nowIso)
        .order("ends_at", { ascending: true }),
      // Auth + favorites runs concurrently instead of after data queries
      resolveUserAndFavorites(request, barKey),
    ]);

  let wallPours: PubWallRow[] = [];
  let wallError: string | null = null;
  if (wallRes.error) {
    const msg =
      `${wallRes.error.message ?? ""} ${wallRes.error.code ?? ""}`.toLowerCase();
    if (
      wallRes.error.code === "42883" ||
      msg.includes("pub_wall_scores") ||
      msg.includes("function")
    ) {
      wallError =
        "Wall requires migration 20260328300000_pub_wall_scores_rpc (run Supabase migrations).";
    } else {
      wallError = wallRes.error.message ?? "Could not load wall.";
    }
  } else {
    wallPours = (wallRes.data ?? []) as PubWallRow[];
  }

  const { data: extraRows, error: extraError } = extraRes;
  if (extraError) {
    return {
      barKey,
      bar,
      extra: {
        distinct_drinkers: 0,
        total_pint_spend: 0,
        my_pint_spend: 0,
      } satisfies PubExtraRow,
      extraError: extraError.message,
      placeDetails: null as PubPlaceRow | null,
      linkedCompetitions: [] as LinkedCompetition[],
      googleOpeningHoursLines: Promise.resolve(null) as Promise<
        string[] | null
      >,
      wallPours,
      wallError,
      userId: authResult.userId,
      userEmail: authResult.userEmail,
      favId: authResult.favId,
    };
  }

  const rawExtra = (extraRows ?? [])[0] as
    | {
        distinct_drinkers?: unknown;
        total_pint_spend?: unknown;
        my_pint_spend?: unknown;
      }
    | undefined;
  const extra: PubExtraRow = {
    distinct_drinkers: Math.round(numFromDb(rawExtra?.distinct_drinkers)),
    total_pint_spend: numFromDb(rawExtra?.total_pint_spend),
    my_pint_spend: numFromDb(rawExtra?.my_pint_spend),
  };

  const { data: placeRow, error: placeErr } = placeRes;
  const { data: comps, error: compErr } = compRes;
  const placeDetailsTyped = !placeErr
    ? ((placeRow ?? null) as PubPlaceRow | null)
    : null;
  const resolvedPlaceId =
    placeDetailsTyped?.google_place_id?.trim() ||
    bar.google_place_id?.trim() ||
    null;

  return {
    barKey,
    bar,
    extra,
    extraError: null as string | null,
    placeDetails: placeDetailsTyped,
    linkedCompetitions: !compErr
      ? ((comps ?? []) as LinkedCompetition[])
      : [],
    googleOpeningHoursLines: loadDeferredGoogleOpeningHours(resolvedPlaceId),
    wallPours,
    wallError,
    userId: authResult.userId,
    userEmail: authResult.userEmail,
    favId: authResult.favId,
  };
}
