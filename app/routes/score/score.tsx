import {
  redirect,
  useLoaderData,
  useLocation,
  useRevalidator,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";
import { AppLink } from "~/i18n/app-link";
import type { User } from "@supabase/supabase-js";
import { BrandedNotice } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import type { BrandedNoticeVariant } from "~/components/branded/BrandedNotice";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import { type Score } from "~/types/score";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { LeaderboardButton } from "~/components/leaderboard/LeaderboardButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { BuyCreatorABeer } from "~/components/BuyCreatorABeer";
import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { ScoreSharePanel } from "~/components/score/ScoreSharePanel";
import type { ParsedPlaceGeo } from "~/utils/placeGeoFromComponents";
import {
  DEFAULT_PUB_GEOFENCE_MAX_METERS,
  haversineDistanceMeters,
} from "~/utils/geo-distance";
import { isScoreUuidRef, scorePourPath } from "~/utils/scorePath";
import {
  clearPostOAuthReturnIfMatchesCurrentPath,
  googleOAuthRedirectToSiteRoot,
  rememberPathBeforeGoogleOAuth,
} from "~/utils/post-oauth-return";
import { generateBeerUsername } from "~/utils/usernameGenerator";
import { pubDetailPath } from "~/utils/pubPath";
import { langFromParams } from "~/i18n/lang-param";
import { localizePath } from "~/i18n/paths";
import { useI18n } from "~/i18n/context";
import { createTranslator } from "~/i18n/load-messages";
import { seoMetaForRoute, seoMetaForScoreDetail } from "~/i18n/seo-meta";
import { supabase } from "~/utils/supabase";

const COMPETITION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emailsMatchClaim(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const x = a?.trim().toLowerCase() ?? "";
  const y = b?.trim().toLowerCase() ?? "";
  return Boolean(x && y && x === y);
}

async function leaderboardDisplayNameForAuthUserClient(
  user: User,
): Promise<string> {
  const supabase = await getSupabaseBrowserClient();
  const { data: profile } = await supabase
    .from("public_profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  const nick =
    typeof profile?.nickname === "string" ? profile.nickname.trim() : "";

  const rawMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const googleFullName =
    (typeof rawMeta.full_name === "string" && rawMeta.full_name.trim()) ||
    (typeof rawMeta.name === "string" && rawMeta.name.trim()) ||
    (typeof rawMeta.given_name === "string" && rawMeta.given_name.trim()) ||
    user.email?.split("@")[0] ||
    "Drinker";

  return nick || googleFullName;
}

export function meta({
  data,
  params,
}: {
  data?: {
    score?: Score;
    allTimeRank?: number;
    totalSplits?: number;
    weeklyRank?: number;
    weeklyTotalSplits?: number;
  };
  params?: { lang?: string };
}) {
  const score = data?.score;
  if (!score) {
    return seoMetaForRoute(params ?? {}, "/", "scoreFallback");
  }

  const scoreValue = Number(score.split_score).toFixed(2);
  const t = createTranslator(langFromParams(params ?? {}));
  const username =
    score.username?.trim() || t("seo.routes.scoreDetail.anonymousUser");
  const allTimeRank = data?.allTimeRank ?? 0;
  const totalSplits = data?.totalSplits ?? 0;
  const weeklyRank = data?.weeklyRank ?? 0;
  const weeklyTotalSplits = data?.weeklyTotalSplits ?? 0;
  const image = score.pint_image_url || score.split_image_url || undefined;

  return seoMetaForScoreDetail(
    params ?? {},
    scorePourPath(score),
    {
      scoreValue,
      username,
      allTimeRank: String(allTimeRank),
      totalSplits: String(totalSplits),
      weeklyRank: String(weeklyRank),
      weeklyTotalSplits: String(weeklyTotalSplits),
    },
    image,
  );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const lang = langFromParams(params);
  const ref = params.pourRef?.trim();
  if (!ref) {
    throw new Response("Score not found", { status: 404 });
  }

  // Get the session cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...v] = c.split("=");
      return [key, v.join("=")];
    })
  );
  const sessionId = cookies["split-g-session"];

  const {
    getSupabaseAccessTokenFromRequestCookies,
    getSupabaseUserFromAccessToken,
  } = await import("~/utils/pour-auth-claim.server");
  const sbAccess = getSupabaseAccessTokenFromRequestCookies(request);
  let authedUserId: string | null = null;
  if (sbAccess) {
    const u = await getSupabaseUserFromAccessToken(sbAccess);
    authedUserId = u?.id ?? null;
  }

  // Get the score data: UUID path uses id; short slug uses slug column
  const query = isScoreUuidRef(ref)
    ? supabase.from("scores").select("*").eq("id", ref).single()
    : supabase.from("scores").select("*").eq("slug", ref).single();

  const { data: score, error } = await query;

  if (error || !score) {
    throw new Response("Score not found", { status: 404 });
  }

  const row = score as Score & { submitter_user_id?: string | null };
  if (isScoreUuidRef(ref) && row.slug?.trim()) {
    return redirect(
      localizePath(
        `/pour/${encodeURIComponent(row.slug.trim())}`,
        lang,
      ),
    );
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekStart = oneWeekAgo.toISOString();

  const [
    { count: higherScoresCount, error: higherScoresError },
    { count: weeklyHigherScoresCount, error: weeklyHigherScoresError },
    { count: totalSplits },
    { count: weeklyTotalSplits },
  ] = await Promise.all([
    supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .gt("split_score", score.split_score),
    supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .gt("split_score", score.split_score)
      .gte("created_at", weekStart),
    supabase.from("scores").select("*", { count: "exact", head: true }),
    supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStart),
  ]);

  if (higherScoresError)
    console.error("Error getting higher scores:", higherScoresError);
  if (weeklyHigherScoresError)
    console.error(
      "Error getting weekly higher scores:",
      weeklyHigherScoresError,
    );

  const allTimeRank = (higherScoresCount ?? 0) + 1;
  const weeklyRank = (weeklyHigherScoresCount ?? 0) + 1;

  const submitterId =
    typeof row.submitter_user_id === "string"
      ? row.submitter_user_id.trim()
      : "";
  const isOwner =
    sessionId === score.session_id ||
    Boolean(
      authedUserId && submitterId && authedUserId === submitterId,
    );

  /** When the venue name matches a pub in the directory (`bar_pub_stats`). */
  let pubPageBarKey: string | null = null;
  const barKeyLookup = (score.bar_name as string | null | undefined)?.trim().toLowerCase();
  if (barKeyLookup) {
    const { data: pubStat } = await supabase
      .from("bar_pub_stats")
      .select("bar_key")
      .eq("bar_key", barKeyLookup)
      .maybeSingle();
    if (pubStat?.bar_key) pubPageBarKey = String(pubStat.bar_key);
  }

  return {
    score,
    allTimeRank,
    weeklyRank,
    totalSplits,
    weeklyTotalSplits,
    isOwner,
    pubPageBarKey,
  };
}

export default function Score() {
  const {
    score,
    allTimeRank,
    weeklyRank,
    totalSplits,
    weeklyTotalSplits,
    isOwner: isOwnerFromLoader,
    pubPageBarKey,
  } = useLoaderData<{
    score: Score;
    allTimeRank: number;
    weeklyRank: number;
    totalSplits: number;
    weeklyTotalSplits: number;
    isOwner: boolean;
    pubPageBarKey: string | null;
  }>();
  const { t, lang } = useI18n();
  const revalidator = useRevalidator();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const competitionIdParam =
    searchParams.get("competition")?.trim() ?? "";
  const competitionId = COMPETITION_UUID_RE.test(competitionIdParam)
    ? competitionIdParam
    : "";
  const [displayUsername, setDisplayUsername] = useState(() =>
    score.username?.trim() ? score.username : "",
  );
  const [barName, setBarName] = useState(score.bar_name || "");
  const [barAddress, setBarAddress] = useState(score.bar_address || "");
  /** Parsed from Google when user picks a suggestion; cleared when they type. */
  const [placeGeo, setPlaceGeo] = useState<ParsedPlaceGeo | null>(null);
  /** When the user picks a Google suggestion with geometry — used to verify device GPS at save. */
  const [placeLatLng, setPlaceLatLng] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(
    score.google_place_id?.trim() || null,
  );
  const [pourRating, setPourRating] = useState(
    score.pour_rating != null ? String(score.pour_rating) : "2.5",
  );
  const [pintPrice, setPintPrice] = useState(
    score.pint_price != null && Number.isFinite(Number(score.pint_price))
      ? String(score.pint_price)
      : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimedEmail, setClaimedEmail] = useState<string | null>(score.email ?? null);
  const [competitionAttachMessage, setCompetitionAttachMessage] = useState<
    string | null
  >(null);
  const [signInToastError, setSignInToastError] = useState<string | null>(null);
  const [unclaimConfirmOpen, setUnclaimConfirmOpen] = useState(false);
  const [isUnclaiming, setIsUnclaiming] = useState(false);

  const isPourOwner = useMemo(
    () =>
      isOwnerFromLoader ||
      Boolean(
        authUser?.id &&
          score.submitter_user_id &&
          authUser.id === score.submitter_user_id,
      ),
    [isOwnerFromLoader, authUser?.id, score.submitter_user_id],
  );

  async function attachScoreToCompetition(compId: string, scoreId: string) {
    const supabase = await getSupabaseBrowserClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("competition_scores").insert({
      competition_id: compId,
      score_id: scoreId,
      user_id: u.user.id,
    });
    if (error) {
      setCompetitionAttachMessage(error.message);
      return;
    }
    setCompetitionAttachMessage(t("pages.score.msgAddedCompetition"));
    revalidator.revalidate();
  }

  useEffect(() => {
    clearPostOAuthReturnIfMatchesCurrentPath(
      location.pathname,
      location.search,
    );
  }, [location.pathname, location.search]);

  useEffect(() => {
    setClaimedEmail(score.email ?? null);
    setDisplayUsername(score.username?.trim() ? score.username : "");
  }, [score.email, score.username]);

  useEffect(() => {
    setBarName(score.bar_name || "");
    setBarAddress(score.bar_address || "");
    setGooglePlaceId(score.google_place_id?.trim() || null);
    setPourRating(
      score.pour_rating != null ? String(score.pour_rating) : "2.5",
    );
    setPintPrice(
      score.pint_price != null && Number.isFinite(Number(score.pint_price))
        ? String(score.pint_price)
        : "",
    );
  }, [score.id]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    async function loadUser() {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setAuthUser(data.user ?? null);
        setIsAuthLoading(false);
      }
    }

    void loadUser();

    void getSupabaseBrowserClient().then((supabase) => {
      if (!mounted) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setAuthUser(session?.user ?? null);
        setIsAuthLoading(false);
      });
      unsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const jwtUsernameSyncDoneKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!authUser?.email || !score.email?.trim()) return;
    if (!emailsMatchClaim(authUser.email, score.email)) return;

    const doneKey = `${score.id}:${authUser.id}`;
    if (jwtUsernameSyncDoneKeyRef.current === doneKey) return;

    void (async () => {
      try {
        const supabase = await getSupabaseBrowserClient();
        const leaderboardName =
          await leaderboardDisplayNameForAuthUserClient(authUser);
        const { error } = await supabase.rpc("sync_scores_username_for_jwt", {
          p_username: leaderboardName,
        });
        if (error) return;
        jwtUsernameSyncDoneKeyRef.current = doneKey;
        revalidator.revalidate();
      } catch {
        // best-effort: keep page usable if RPC fails
      }
    })();
  }, [
    authUser,
    isAuthLoading,
    revalidator,
    score.email,
    score.id,
  ]);

  const handleGoogleSignIn = async () => {
    setClaimMessage(null);
    setSignInToastError(null);
    rememberPathBeforeGoogleOAuth();
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: googleOAuthRedirectToSiteRoot(),
      },
    });
    if (error) {
      const detail =
        error.message?.trim() ||
        t("pages.score.msgSignInTryAgainDetail");
      setSignInToastError(
        t("errors.signInGoogleFailed", { detail }),
      );
    }
  };

  const handleClaimWithGoogle = async () => {
    if (!authUser?.email || !isPourOwner) return;

    setIsClaiming(true);
    setClaimMessage(null);

    try {
      const supabase = await getSupabaseBrowserClient();
      const leaderboardName =
        await leaderboardDisplayNameForAuthUserClient(authUser);

      const { error } = await supabase
        .from("scores")
        .update({
          email: authUser.email,
          email_opted_out: false,
          username: leaderboardName,
        })
        .eq("id", score.id)
        .select("id, email, username")
        .single();

      if (error) throw error;

      await supabase.rpc("sync_scores_username_for_jwt", {
        p_username: leaderboardName,
      });

      setDisplayUsername(leaderboardName);
      setClaimedEmail(authUser.email);
      setClaimMessage(t("pages.score.msgClaimSuccess"));
      if (competitionId) {
        void attachScoreToCompetition(competitionId, score.id);
      }
      revalidator.revalidate();
    } catch (_error) {
      setClaimMessage(t("pages.score.msgClaimFailed"));
    } finally {
      setIsClaiming(false);
    }
  };

  const handleUnclaim = async () => {
    if (!authUser?.email || !isPourOwner || !score.email) return;
    if (!emailsMatchClaim(authUser.email, score.email)) return;

    setUnclaimConfirmOpen(false);
    setIsUnclaiming(true);
    setClaimMessage(null);

    try {
      const supabase = await getSupabaseBrowserClient();
      const nextUsername = generateBeerUsername();
      const { error } = await supabase
        .from("scores")
        .update({
          email: null,
          username: nextUsername,
          email_opted_out: false,
        })
        .eq("id", score.id)
        .select("id, email, username")
        .single();

      if (error) throw error;
      setClaimedEmail(null);
      setDisplayUsername(nextUsername);
      setClaimMessage(t("pages.score.msgUnclaimSuccess"));
      revalidator.revalidate();
    } catch (_error) {
      setClaimMessage(t("pages.score.msgUnclaimFailed"));
    } finally {
      setIsUnclaiming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const nameTrim = barName.trim();
    if (!nameTrim) {
      setSubmitError(t("errors.barNameRequired"));
      setIsSubmitting(false);
      return;
    }

    const ratingVal = parseFloat(pourRating);
    if (!Number.isFinite(ratingVal) || ratingVal < 0 || ratingVal > 5) {
      setSubmitError(t("errors.ratingRange"));
      setIsSubmitting(false);
      return;
    }

    const pintTrim = pintPrice.trim();
    let pintPriceVal: number | null = null;
    if (pintTrim !== "") {
      const p = parseFloat(pintTrim);
      if (!Number.isFinite(p) || p < 0) {
        setSubmitError(t("errors.pintPriceNonNegative"));
        setIsSubmitting(false);
        return;
      }
      if (p > 999_999.99) {
        setSubmitError(t("errors.pintPriceTooLarge"));
        setIsSubmitting(false);
        return;
      }
      pintPriceVal = Math.round(p * 100) / 100;
    }

    const geoPatch: Record<string, string | null> = {};
    if (placeGeo) {
      if (placeGeo.city) geoPatch.city = placeGeo.city;
      if (placeGeo.region) geoPatch.region = placeGeo.region;
      if (placeGeo.country) geoPatch.country = placeGeo.country;
      if (placeGeo.countryCode) geoPatch.country_code = placeGeo.countryCode;
    }

    const placeIdForSave = googlePlaceId?.trim() || null;
    if (placeIdForSave && placeLatLng) {
      const geoOk = await new Promise<boolean>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          resolve(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const d = haversineDistanceMeters(placeLatLng, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            resolve(d <= DEFAULT_PUB_GEOFENCE_MAX_METERS);
          },
          () => resolve(false),
          {
            enableHighAccuracy: true,
            timeout: 18_000,
            maximumAge: 0,
          },
        );
      });
      if (!geoOk) {
        setSubmitError(t("pages.score.geofenceVenueMismatch"));
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const supabase = await getSupabaseBrowserClient();
      const { error } = await supabase
        .from("scores")
        .update({
          bar_name: nameTrim,
          bar_address: barAddress.trim() || null,
          google_place_id: placeIdForSave,
          pour_rating: ratingVal,
          pint_price: pintPriceVal,
          ...geoPatch,
        })
        .eq("id", score.id)
        .select(
          "id, bar_name, bar_address, google_place_id, pour_rating, pint_price, city, region, country, country_code",
        )
        .single();

      if (error) throw error;

      setPlaceGeo(null);
      setSubmitSuccess(true);
      if (competitionId) {
        void attachScoreToCompetition(competitionId, score.id);
      }
      revalidator.revalidate();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : t("errors.saveRatingFailed");
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const celebrationLine = useMemo(() => {
    const s = score.split_score;
    if (s >= 4.7) return t("pages.score.celebrationHigh");
    if (s >= 3.75) return t("pages.score.celebrationMidHigh");
    if (s >= 3.0) return t("pages.score.celebrationMid");
    return t("pages.score.celebrationLow");
  }, [score.split_score, t]);

  const geoFallbackLine = [score.city, score.region, score.country]
    .filter((p): p is string => Boolean(p?.trim()))
    .join(", ");

  const hasSavedRating =
    (score.bar_name?.trim() ?? "") !== "" && score.pour_rating != null;

  const canUnclaim =
    isPourOwner &&
    Boolean(authUser?.email) &&
    Boolean(score.email?.trim()) &&
    emailsMatchClaim(authUser?.email, score.email);

  const pintPriceSavedLabel =
    score.pint_price != null && Number.isFinite(Number(score.pint_price))
      ? Number(score.pint_price).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : null;
  const closeupUrl =
    score.g_closeup_image_url?.trim() || score.split_image_url || null;
  const annotatedUrl = score.split_image_url || null;
  const ratingDisplay = Number.isFinite(parseFloat(pourRating))
    ? parseFloat(pourRating).toFixed(1)
    : "0.0";

  const scoreToastText =
    signInToastError ??
    submitError ??
    claimMessage ??
    competitionAttachMessage ??
    (submitSuccess ? t("pages.score.msgRatingSaved") : null) ??
    "";

  const scoreToastVariant = useMemo((): BrandedNoticeVariant => {
    if (signInToastError) return "warning";
    if (submitError) return "danger";
    if (claimMessage) {
      if (
        claimMessage === t("pages.score.msgClaimSuccess") ||
        claimMessage === t("pages.score.msgUnclaimSuccess")
      )
        return "success";
      return "danger";
    }
    if (competitionAttachMessage) {
      return competitionAttachMessage === t("pages.score.msgAddedCompetition")
        ? "success"
        : "danger";
    }
    if (submitSuccess) return "success";
    return "info";
  }, [
    signInToastError,
    submitError,
    claimMessage,
    competitionAttachMessage,
    submitSuccess,
    t,
  ]);

  return (
    <main className="min-h-screen bg-guinness-black">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:max-w-5xl md:py-8 md:px-8">
        {/* Logo and Title */}
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <SplitTheGLogo className="mx-auto" />
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-guinness-gold text-center">
            {t("pages.score.resultsTitle")}
          </h1>
        </div>

        {competitionId ? (
          <div className="mx-auto mt-4 max-w-lg rounded-lg border border-guinness-gold/30 bg-guinness-gold/10 px-4 py-3 text-center text-sm text-guinness-cream">
            <p>
              {t("pages.score.compLinked")}{" "}
              <AppLink
                to={`/competitions/${competitionId}`}
                viewTransition
                className="font-semibold text-guinness-gold underline hover:text-guinness-tan"
              >
                {t("pages.score.competitionWord")}
              </AppLink>
              {t("pages.score.compLinkedHint")}
            </p>
          </div>
        ) : null}

        {/* Score Card */}
        <div className="mt-6 sm:mt-8">
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#312814] bg-guinness-brown/30 px-5 py-6 sm:px-7 sm:py-7">
            <p className="text-center text-lg font-semibold text-guinness-cream sm:text-xl md:text-left">
              {displayUsername.trim() || t("pages.score.anonymousDisplay")}
            </p>

            <div className="mt-6 flex flex-col items-center gap-6 border-t border-[#312814] pt-6 md:flex-row md:items-start md:justify-between md:gap-8">
              <div className="text-center md:text-left">
                <p className="text-5xl font-bold tabular-nums leading-none text-guinness-gold sm:text-6xl">
                  {score.split_score.toFixed(2)}
                </p>
                <p className="type-meta mt-2 text-guinness-tan/65">
                  {t("pages.score.outOfFive")}
                </p>
              </div>
              <div className="grid w-full max-w-[16rem] grid-cols-2 gap-4 text-center md:max-w-none md:grid-cols-1 md:text-right">
                <div>
                  <p className="type-meta text-guinness-tan/55">
                    {t("pages.score.allTime")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-guinness-gold sm:text-base">
                    #{allTimeRank}
                    <span className="font-normal text-guinness-tan/65">
                      {" "}
                      / {totalSplits}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="type-meta text-guinness-tan/55">
                    {t("pages.score.thisWeek")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-guinness-gold sm:text-base">
                    #{weeklyRank}
                    <span className="font-normal text-guinness-tan/65">
                      {" "}
                      / {weeklyTotalSplits}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#312814] pt-5">
              {score.bar_name?.trim() ? (
                <div className="text-center md:text-left">
                  <p className="type-meta mb-2 text-guinness-tan/55">
                    {t("pages.score.venue")}
                  </p>
                  {pubPageBarKey ? (
                    <AppLink
                      to={pubDetailPath(pubPageBarKey)}
                      viewTransition
                      className="inline-block text-base font-medium text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 transition-colors hover:text-guinness-tan hover:decoration-guinness-gold/60 sm:text-lg"
                    >
                      {score.bar_name.trim()}
                    </AppLink>
                  ) : (
                    <p className="text-base font-medium text-guinness-cream sm:text-lg">
                      {score.bar_name.trim()}
                    </p>
                  )}
                  {score.bar_address?.trim() ? (
                    <p className="type-meta mx-auto mt-2 max-w-md text-guinness-tan/70 leading-relaxed md:mx-0">
                      {score.bar_address.trim()}
                    </p>
                  ) : null}
                </div>
              ) : geoFallbackLine ? (
                <div className="text-center md:text-left">
                  <p className="type-meta mb-1.5 text-guinness-tan/55">
                    {t("pages.score.location")}
                  </p>
                  <p className="text-sm text-guinness-tan/80">{geoFallbackLine}</p>
                </div>
              ) : (
                <p className="type-meta text-center text-guinness-tan/60 md:text-left">
                  {t("pages.score.noVenueSaved")}
                </p>
              )}
            </div>

            <p className="mt-6 border-t border-[#312814] pt-5 text-center text-base leading-snug text-guinness-cream/90 md:text-left md:text-lg">
              {celebrationLine}
            </p>
          </div>
        </div>

        {/* Image comparison — close-up vs annotated frame */}
        <section
          className="mt-8 md:mt-10"
          aria-label={t("pages.score.imagesSectionAria")}
        >
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:mx-auto md:max-w-4xl md:grid-cols-2 lg:gap-5">
            <article className="flex flex-col rounded-2xl border border-[#312814] bg-guinness-brown/30 p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.05)] sm:p-5">
              <header className="mb-4 border-b border-[#312814] pb-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="type-card-title text-base sm:text-lg">
                    {t("pages.score.splitGTitle")}
                  </h3>
                  <span className="shrink-0 rounded-md border border-[#312814] bg-guinness-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-guinness-tan/70 sm:text-[11px]">
                    {t("pages.score.closeupBadge")}
                  </span>
                </div>
                <p className="type-meta mt-2 text-guinness-tan/65">
                  {t("pages.score.closeupHint")}
                </p>
              </header>
              <div className="aspect-square overflow-hidden rounded-xl border border-[#312814] bg-guinness-black/55">
                {closeupUrl ? (
                  <img
                    src={closeupUrl}
                    alt={t("pages.score.closeupAlt")}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-4 type-meta text-guinness-tan/55">
                    {t("pages.score.noImageAvailable")}
                  </div>
                )}
              </div>
            </article>

            <article className="flex flex-col rounded-2xl border border-[#312814] bg-guinness-brown/30 p-4 shadow-[inset_0_1px_0_rgba(212,175,55,0.05)] sm:p-5">
              <header className="mb-4 border-b border-[#312814] pb-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="type-card-title text-base sm:text-lg">
                    {t("pages.score.originalPourTitle")}
                  </h3>
                  <span className="shrink-0 rounded-md border border-[#312814] bg-guinness-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-guinness-tan/70 sm:text-[11px]">
                    {t("pages.score.fullFrameBadge")}
                  </span>
                </div>
                <p className="type-meta mt-2 text-guinness-tan/65">
                  {t("pages.score.annotatedHint")}
                </p>
              </header>
              <div className="aspect-square overflow-hidden rounded-xl border border-[#312814] bg-guinness-black/55">
                {annotatedUrl ? (
                  <img
                    src={annotatedUrl}
                    alt={t("pages.score.annotatedAlt")}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-4 type-meta text-guinness-tan/55">
                    {t("pages.score.noImageAvailable")}
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>

        {isPourOwner && (
          <div className="mx-auto mt-8 max-w-3xl md:grid md:grid-cols-2 md:items-start md:gap-x-10 lg:gap-x-14">
            <section className="border-b border-guinness-gold/15 pb-8 md:border-b-0 md:border-r md:border-guinness-gold/15 md:pb-0 md:pr-8 lg:pr-10">
              <h2 className="type-card-title">
                {t("pages.score.claimSplitTitle")}
              </h2>
              <p className="type-meta mt-2">
                {t("pages.score.claimSplitBlurb")}
              </p>

              <div className="mt-5 space-y-3">
                {claimedEmail ? (
                  <>
                    <p className="type-label text-guinness-gold">
                      {t("pages.score.claimedBy", { email: claimedEmail })}
                    </p>
                    {canUnclaim ? (
                      <button
                        type="button"
                        disabled={isUnclaiming}
                        onClick={() => setUnclaimConfirmOpen(true)}
                        className="w-full rounded-lg border border-red-400/40 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-300/95 transition-colors hover:bg-red-950/35 disabled:opacity-50"
                      >
                        {isUnclaiming
                          ? t("pages.score.unclaimWorking")
                          : t("pages.score.unclaimButton")}
                      </button>
                    ) : null}
                  </>
                ) : authUser ? (
                  <>
                    <p className="type-meta text-guinness-tan/70">
                      {t("pages.score.signedInAs", { email: authUser.email ?? "" })}
                    </p>
                    <button
                      type="button"
                      onClick={handleClaimWithGoogle}
                      disabled={isClaiming}
                      className="w-full rounded-lg bg-guinness-gold px-4 py-2.5 font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isClaiming
                        ? t("pages.score.claiming")
                        : t("pages.score.claimWithGoogle")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isAuthLoading}
                    className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAuthLoading
                      ? t("pages.score.checkingSignIn")
                      : t("pages.score.signInGoogle")}
                  </button>
                )}
              </div>
            </section>

            <section className="pt-8 md:pt-0">
              {hasSavedRating ? (
                <>
                  <h2 className="type-card-title">
                    {t("pages.score.yourRatingTitle")}
                  </h2>
                  <dl className="mt-4 divide-y divide-guinness-gold/10">
                    <div className="grid gap-1 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                      <dt className="type-label text-guinness-tan/75">
                        {t("pages.score.barNameLabel")}
                      </dt>
                      <dd className="text-guinness-cream">{score.bar_name}</dd>
                    </div>
                    <div className="grid gap-1 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                      <dt className="type-label text-guinness-tan/75">
                        {t("pages.score.dtPourRating")}
                      </dt>
                      <dd className="tabular-nums text-guinness-cream">
                        {Number(score.pour_rating).toFixed(1)}
                        {t("pages.score.slashOutOfFive")}
                      </dd>
                    </div>
                    <div className="grid gap-1 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                      <dt className="type-label text-guinness-tan/75">
                        {t("pages.score.dtPintPrice")}
                      </dt>
                      <dd className="text-guinness-cream">
                        {pintPriceSavedLabel != null
                          ? pintPriceSavedLabel
                          : t("pages.score.notSet")}
                        {pintPriceSavedLabel != null ? (
                          <span className="type-meta ml-2 text-guinness-tan/50">
                            {t("pages.score.localCurrencyHint")}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="type-card-title">
                    {t("pages.score.ratePourTitle")}
                  </h2>
                  <p className="type-meta">{t("pages.score.ratePourBlurb")}</p>
                  <div className="space-y-5 pt-1">
                  <div>
                    <label htmlFor="barName" className="type-label mb-1 block">
                      {t("pages.score.barOrVenueLabel")}
                    </label>
                    <PlacesAutocomplete
                      initialValue={barName}
                      onChangeText={(v) => {
                        setBarName(v);
                        setPlaceGeo(null);
                        setPlaceLatLng(null);
                        setGooglePlaceId(null);
                      }}
                      onSelect={(data) => {
                        setBarName(data.name);
                        setBarAddress(data.address);
                        setPlaceGeo(data.geo);
                        setGooglePlaceId(data.placeId?.trim() || null);
                        const lat = data.placeLatitude;
                        const lng = data.placeLongitude;
                        if (
                          typeof lat === "number" &&
                          typeof lng === "number" &&
                          Number.isFinite(lat) &&
                          Number.isFinite(lng)
                        ) {
                          setPlaceLatLng({ lat, lng });
                        } else {
                          setPlaceLatLng(null);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="pintPrice" className="type-label mb-1 block">
                      {t("pages.score.pintPriceShort")}{" "}
                      <span className="font-normal text-guinness-tan/60">
                        {t("pages.score.pintPriceOptionalParenthetical")}
                      </span>
                    </label>
                    <input
                      id="pintPrice"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      placeholder={t("pages.score.pintPricePlaceholder")}
                      value={pintPrice}
                      onChange={(e) => setPintPrice(e.target.value)}
                      className="w-full rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-guinness-cream placeholder:text-guinness-tan/40 focus:border-guinness-gold focus:outline-none"
                    />
                    <p className="type-meta mt-1.5 text-guinness-tan/55">
                      {t("pages.score.pintPriceHint")}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <label
                        htmlFor="pourRating"
                        id="pourRatingLabel"
                        className="type-label"
                      >
                        {t("pages.score.pourRatingSliderLabel")}
                      </label>
                      <span
                        className="text-lg font-semibold tabular-nums text-guinness-gold"
                        aria-live="polite"
                      >
                        {ratingDisplay}
                        {t("pages.score.slashOutOfFive")}
                      </span>
                    </div>
                    <input
                      type="range"
                      id="pourRating"
                      min={0}
                      max={5}
                      step={0.1}
                      value={pourRating}
                      onChange={(e) => setPourRating(e.target.value)}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-guinness-black/80 accent-guinness-gold"
                      aria-labelledby="pourRatingLabel"
                      aria-valuetext={t("pages.score.ariaRatingOutOfFive", {
                        rating: ratingDisplay,
                      })}
                    />
                    <div className="mt-1 flex justify-between type-meta text-guinness-tan/60">
                      <span>0</span>
                      <span>5</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-guinness-gold px-4 py-3 font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? t("pages.score.savingShort")
                      : t("pages.score.saveRating")}
                  </button>
                </div>
              </form>
              )}
            </section>
          </div>
        )}

        {/* Actions + support — single panel */}
        <section
          className="mx-auto mt-8 w-full max-w-xl rounded-2xl bg-guinness-brown/20 px-5 py-6 shadow-[inset_0_1px_0_rgba(212,175,55,0.06)] ring-1 ring-guinness-gold/10 sm:px-6 sm:py-7 md:max-w-3xl"
          aria-label={t("pages.score.shareActionsAria")}
        >
          <ScoreSharePanel
            sharePath={localizePath(scorePourPath(score), lang)}
            splitScore={score.split_score}
            allTimeRank={allTimeRank}
            totalSplits={totalSplits}
            weeklyRank={weeklyRank}
            weeklyTotalSplits={weeklyTotalSplits}
            previewImageUrl={score.pint_image_url || annotatedUrl}
          />

          <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
            <AppLink
              to="/"
              viewTransition
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-guinness-gold px-4 py-3 text-center text-sm font-semibold text-guinness-black shadow-[0_0_0_1px_rgba(212,175,55,0.2)] transition-colors hover:bg-guinness-tan sm:text-base"
            >
              {t("pages.score.tryAgain")}
            </AppLink>

            <LeaderboardButton className="flex min-h-12 w-full items-center justify-center px-4 py-3 text-sm sm:text-base" />
          </div>

          <div className="mt-5 flex flex-col items-center justify-center gap-1 border-t border-guinness-gold/10 pt-5 text-center sm:flex-row sm:flex-wrap sm:gap-x-2 sm:gap-y-1">
            <span className="type-meta text-guinness-tan/55">
              {t("pages.score.enjoying")}
            </span>
            <BuyCreatorABeer variant="compact" />
          </div>
        </section>
      </div>

      <BrandedToast
        open={Boolean(scoreToastText)}
        message={scoreToastText}
        variant={scoreToastVariant}
        title={
          scoreToastVariant === "danger"
            ? t("pages.score.toastCouldntComplete")
            : scoreToastVariant === "warning"
              ? t("pages.score.toastHeadsUp")
              : undefined
        }
        onClose={() => {
          setSignInToastError(null);
          setSubmitError(null);
          setClaimMessage(null);
          setSubmitSuccess(false);
          setCompetitionAttachMessage(null);
        }}
        autoCloseMs={toastAutoCloseForVariant(scoreToastVariant)}
      />

      <BrandedNotice
        open={unclaimConfirmOpen}
        onOpenChange={setUnclaimConfirmOpen}
        title={t("pages.score.unclaimDialogTitle")}
        description={t("pages.score.unclaimDialogDescription")}
        variant="warning"
        secondaryLabel={t("pages.score.keepClaim")}
        primaryLabel={
          isUnclaiming ? t("pages.score.unclaimBusy") : t("pages.score.unclaimConfirm")
        }
        onPrimary={() => void handleUnclaim()}
      />
    </main>
  );
}
