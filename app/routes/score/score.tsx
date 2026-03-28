import {
  redirect,
  useLoaderData,
  useLocation,
  useRevalidator,
  useSearchParams,
  type LoaderFunctionArgs,
  Link,
} from "react-router";
import type { User } from "@supabase/supabase-js";
import { BrandedToast } from "~/components/branded/BrandedToast";
import {
  scorePageFeedbackVariant,
  toastAutoCloseForVariant,
} from "~/components/branded/feedback-variant";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import { type Score } from "~/types/score";
import { supabase } from "~/utils/supabase";
import { LeaderboardButton } from "~/components/leaderboard/LeaderboardButton";
import { useEffect, useState } from "react";
import { BuyCreatorsABeer } from "~/components/BuyCreatorsABeer";
import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import type { ParsedPlaceGeo } from "~/utils/placeGeoFromComponents";
import { isScoreUuidRef, scorePourPath } from "~/utils/scorePath";
import {
  clearPostOAuthReturnIfMatchesCurrentPath,
  googleOAuthRedirectToSiteRoot,
  rememberPathBeforeGoogleOAuth,
} from "~/utils/post-oauth-return";

const COMPETITION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loader({ params, request }: LoaderFunctionArgs) {
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

  // Get the score data: UUID path uses id; short slug uses slug column
  const query = isScoreUuidRef(ref)
    ? supabase.from("scores").select("*").eq("id", ref).single()
    : supabase.from("scores").select("*").eq("slug", ref).single();

  const { data: score, error } = await query;

  if (error || !score) {
    throw new Response("Score not found", { status: 404 });
  }

  const row = score as Score;
  if (isScoreUuidRef(ref) && row.slug?.trim()) {
    return redirect(`/pour/${encodeURIComponent(row.slug.trim())}`);
  }

  // Calculate date 7 days ago
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get count of all-time higher scores
  const { count: higherScoresCount, error: higherScoresError } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .gt("split_score", score.split_score);

  if (higherScoresError)
    console.error("Error getting higher scores:", higherScoresError);

  // Get count of weekly higher scores
  const { count: weeklyHigherScoresCount, error: weeklyHigherScoresError } =
    await supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .gt("split_score", score.split_score)
      .gte("created_at", oneWeekAgo.toISOString());

  if (weeklyHigherScoresError)
    console.error(
      "Error getting weekly higher scores:",
      weeklyHigherScoresError
    );

  // Get total splits (all-time)
  const { count: totalSplits } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true });

  // Get total splits this week
  const { count: weeklyTotalSplits } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .gte("created_at", oneWeekAgo.toISOString());

  const allTimeRank = (higherScoresCount ?? 0) + 1;
  const weeklyRank = (weeklyHigherScoresCount ?? 0) + 1;

  // Check if the user owns this score
  const isOwner = sessionId === score.session_id;

  return {
    score,
    allTimeRank,
    weeklyRank,
    totalSplits,
    weeklyTotalSplits,
    isOwner,
  };
}

export default function Score() {
  const {
    score,
    allTimeRank,
    weeklyRank,
    totalSplits,
    weeklyTotalSplits,
    isOwner,
  } = useLoaderData<{
    score: Score;
    allTimeRank: number;
    weeklyRank: number;
    totalSplits: number;
    weeklyTotalSplits: number;
    isOwner: boolean;
  }>();
  const revalidator = useRevalidator();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const competitionIdParam =
    searchParams.get("competition")?.trim() ?? "";
  const competitionId = COMPETITION_UUID_RE.test(competitionIdParam)
    ? competitionIdParam
    : "";
  const [shareSuccess, setShareSuccess] = useState(false);
  const [displayUsername, setDisplayUsername] = useState(
    score.username || "Anonymous Pourer"
  );
  const [barName, setBarName] = useState(score.bar_name || "");
  const [barAddress, setBarAddress] = useState(score.bar_address || "");
  /** Parsed from Google when user picks a suggestion; cleared when they type. */
  const [placeGeo, setPlaceGeo] = useState<ParsedPlaceGeo | null>(null);
  const [pourRating, setPourRating] = useState(
    score.pour_rating != null ? String(score.pour_rating) : "2.5",
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

  async function attachScoreToCompetition(compId: string, scoreId: string) {
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
    setCompetitionAttachMessage("Added to competition.");
    revalidator.revalidate();
  }

  useEffect(() => {
    clearPostOAuthReturnIfMatchesCurrentPath(
      location.pathname,
      location.search,
    );
  }, [location.pathname, location.search]);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setAuthUser(data.user ?? null);
        setIsAuthLoading(false);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setClaimMessage(null);
    setSignInToastError(null);
    rememberPathBeforeGoogleOAuth();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: googleOAuthRedirectToSiteRoot(),
      },
    });
    if (error) {
      const detail =
        error.message?.trim() ||
        "Try again shortly.";
      setSignInToastError(`Couldn’t start Google sign-in. ${detail}`);
    }
  };

  const handleClaimWithGoogle = async () => {
    if (!authUser?.email || !isOwner) return;

    setIsClaiming(true);
    setClaimMessage(null);

    try {
      const rawMeta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const googleName =
        (typeof rawMeta.full_name === "string" && rawMeta.full_name.trim()) ||
        (typeof rawMeta.name === "string" && rawMeta.name.trim()) ||
        (typeof rawMeta.given_name === "string" && rawMeta.given_name.trim()) ||
        authUser.email.split("@")[0];

      const { error } = await supabase
        .from("scores")
        .update({
          email: authUser.email,
          email_opted_out: false,
          username: googleName,
        })
        .eq("id", score.id)
        .select("id, email, username")
        .single();

      if (error) throw error;
      setDisplayUsername(googleName);
      setClaimedEmail(authUser.email);
      setClaimMessage("Score claimed successfully with Google.");
      if (competitionId) {
        void attachScoreToCompetition(competitionId, score.id);
      }
    } catch (_error) {
      setClaimMessage("Failed to claim this score. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const nameTrim = barName.trim();
    if (!nameTrim) {
      setSubmitError("Enter a bar name (search or type your own).");
      setIsSubmitting(false);
      return;
    }

    const ratingVal = parseFloat(pourRating);
    if (!Number.isFinite(ratingVal) || ratingVal < 0 || ratingVal > 5) {
      setSubmitError("Pour rating must be between 0 and 5.");
      setIsSubmitting(false);
      return;
    }

    const geoPatch: Record<string, string | null> = {};
    if (placeGeo) {
      if (placeGeo.city) geoPatch.city = placeGeo.city;
      if (placeGeo.region) geoPatch.region = placeGeo.region;
      if (placeGeo.country) geoPatch.country = placeGeo.country;
      if (placeGeo.countryCode) geoPatch.country_code = placeGeo.countryCode;
    }

    try {
      const { error } = await supabase
        .from("scores")
        .update({
          bar_name: nameTrim,
          bar_address: barAddress.trim() || null,
          pour_rating: ratingVal,
          ...geoPatch,
        })
        .eq("id", score.id)
        .select("id, bar_name, bar_address, pour_rating, city, region, country, country_code")
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
        error instanceof Error ? error.message : "Could not save rating.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreMessage = (score: number) => {
    if (score >= 4.7) return "Sláinte! A perfect split.";
    if (score >= 3.75) return "Beautiful split. Like a true Dubliner.";
    if (score >= 3.0) return "Cheers for trying. Have another go.";
    return "The perfect split awaits. Try again.";
  };

  const getShareMessage = () => {
    const scoreUrl = `${window.location.origin}${scorePourPath(score)}`;

    return (
      `Split G score: ${score.split_score.toFixed(2)}/5.0\n` +
      `All-time rank: #${allTimeRank} of ${totalSplits}\n` +
      `Weekly rank: #${weeklyRank} of ${weeklyTotalSplits}\n` +
      `${scoreUrl}`
    );
  };

  const handleShare = async () => {
    const shareText = getShareMessage();

    try {
      if (navigator.share) {
        await navigator.share({
          text: shareText,
        });
        setShareSuccess(true);
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareText);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatLocation = (s: Score) => {
    const venue = s.bar_name?.trim();
    if (venue) {
      const addr = s.bar_address?.trim();
      return addr ? `${venue} · ${addr}` : venue;
    }
    const parts: string[] = [];
    if (s.city) parts.push(s.city);
    if (s.region) parts.push(s.region);
    if (s.country) parts.push(s.country);
    if (parts.length > 0) return parts.join(", ");
    return "Unknown location";
  };

  const hasSavedRating =
    (score.bar_name?.trim() ?? "") !== "" && score.pour_rating != null;
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
    (submitSuccess ? "Rating saved successfully." : null) ??
    "";
  const scoreToastVariant = scoreToastText
    ? scorePageFeedbackVariant(scoreToastText)
    : "info";

  return (
    <main className="min-h-screen bg-guinness-black">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:max-w-5xl md:py-8 md:px-8">
        {/* Logo and Title */}
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <SplitTheGLogo className="mx-auto" />
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-guinness-gold text-center">
            Results
          </h1>
        </div>

        {competitionId ? (
          <div className="mx-auto mt-4 max-w-lg rounded-lg border border-guinness-gold/30 bg-guinness-gold/10 px-4 py-3 text-center text-sm text-guinness-cream">
            <p>
              This pour is linked to a{" "}
              <Link
                to={`/competitions/${competitionId}`}
                viewTransition
                className="font-semibold text-guinness-gold underline hover:text-guinness-tan"
              >
                competition
              </Link>
              . Join the comp (if needed), claim with Google, then save your bar
              &amp; rating — we&apos;ll add this score automatically.
            </p>
          </div>
        ) : null}

        {/* Score Card */}
        <div className="mt-6 sm:mt-8 text-center">
          <div className="mt-4 inline-block w-full max-w-lg bg-guinness-gold/10 rounded-lg border border-guinness-gold/20 p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="text-xl md:text-2xl font-semibold text-guinness-cream mb-2">
                {displayUsername}
              </div>
              <div className="type-meta mb-4">{formatLocation(score)}</div>
              <div className="type-body-muted mb-4 flex flex-col gap-1">
                <div>
                  All-time: #{allTimeRank} of {totalSplits}
                </div>
                <div>
                  This week: #{weeklyRank} of {weeklyTotalSplits}
                </div>
              </div>
              <div className="text-6xl md:text-7xl font-bold text-guinness-gold mb-2 tabular-nums">
                {score.split_score.toFixed(2)}
              </div>
              <div className="text-xl md:text-2xl type-body-muted mb-3">
                out of 5.0
              </div>
              <div className="text-lg md:text-xl text-guinness-cream/90 mt-2 max-w-md text-center">
                {getScoreMessage(score.split_score)}
              </div>
            </div>
          </div>
        </div>

        {/* Image comparison — early on mobile */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 md:max-w-4xl md:mx-auto">
          <div className="rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-3 sm:p-4">
            <h2 className="type-card-title mb-2">Your Split G</h2>
            <p className="type-meta mb-3 text-guinness-tan/70">
              Close-up on the G from your pour
            </p>
            <div className="aspect-square overflow-hidden rounded-lg bg-guinness-black">
              {closeupUrl ? (
                <img
                  src={closeupUrl}
                  alt="G logo close-up from your split"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-guinness-tan">
                  No image available
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-3 sm:p-4">
            <h2 className="type-card-title mb-2">Original pour</h2>
            <p className="type-meta mb-3 text-guinness-tan/70">
              Full frame with analysis overlay
            </p>
            <div className="aspect-square overflow-hidden rounded-lg bg-guinness-black">
              {annotatedUrl ? (
                <img
                  src={annotatedUrl}
                  alt="Annotated pour analysis"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-guinness-tan">
                  No image available
                </div>
              )}
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="mx-auto mt-8 max-w-lg rounded-lg border border-guinness-gold/20 bg-guinness-gold/10 p-5">
            <h2 className="type-card-title mb-2">Claim this split</h2>
            <p className="type-meta mb-4">
              Sign in with Google to claim this score to your email.
            </p>

            {claimedEmail ? (
              <p className="type-label text-guinness-gold">
                Claimed by: {claimedEmail}
              </p>
            ) : authUser ? (
              <div className="space-y-3">
                <p className="type-meta">Signed in as: {authUser.email}</p>
                <button
                  type="button"
                  onClick={handleClaimWithGoogle}
                  disabled={isClaiming}
                  className="w-full rounded-lg bg-guinness-gold px-4 py-2 font-medium text-guinness-black transition-colors hover:bg-guinness-tan disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClaiming ? "Claiming..." : "Claim with Google"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthLoading}
                className="w-full rounded-lg bg-white px-4 py-2 font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAuthLoading ? "Checking sign-in..." : "Sign in with Google"}
              </button>
            )}

          </div>
        )}

        {isOwner && (
          <div className="mx-auto mt-8 max-w-lg">
            {hasSavedRating ? (
              <div className="rounded-lg border border-guinness-gold/20 bg-guinness-gold/10 p-6 backdrop-blur-sm">
                <h2 className="type-section mb-4">Your rating</h2>
                <div className="space-y-4">
                  <div>
                    <span className="type-label mb-1 block">Bar name</span>
                    <div className="w-full rounded-lg border border-guinness-gold/20 bg-guinness-black/50 px-4 py-2 text-guinness-tan">
                      {score.bar_name}
                    </div>
                  </div>
                  <div>
                    <span className="type-label mb-1 block">Pour rating</span>
                    <div className="w-full rounded-lg border border-guinness-gold/20 bg-guinness-black/50 px-4 py-2 text-guinness-tan">
                      {Number(score.pour_rating).toFixed(1)} / 5
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-lg border border-guinness-gold/20 bg-guinness-gold/10 p-6 backdrop-blur-sm"
              >
                <h2 className="type-section mb-1">Rate the pour</h2>
                <p className="type-meta mb-4">
                  Search for the venue or type its name, then set your rating.
                </p>
                <div className="space-y-5">
                  <div>
                    <label htmlFor="barName" className="type-label mb-1 block">
                      Bar or venue
                    </label>
                    <PlacesAutocomplete
                      initialValue={barName}
                      onChangeText={(v) => {
                        setBarName(v);
                        setPlaceGeo(null);
                      }}
                      onSelect={(data) => {
                        setBarName(data.name);
                        setBarAddress(data.address);
                        setPlaceGeo(data.geo);
                      }}
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <label
                        htmlFor="pourRating"
                        id="pourRatingLabel"
                        className="type-label"
                      >
                        Pour rating
                      </label>
                      <span
                        className="text-lg font-semibold tabular-nums text-guinness-gold"
                        aria-live="polite"
                      >
                        {ratingDisplay} / 5
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
                      aria-valuetext={`${ratingDisplay} out of 5`}
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
                    {isSubmitting ? "Saving..." : "Save rating"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Add Buy Creators a Beer button here - just after the images */}
        <div className="flex justify-center mt-6 mb-8">
          <div className="text-center">
            <p className="type-body-muted mb-3">Enjoying Split the G?</p>
            <BuyCreatorsABeer />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex w-full max-w-xl flex-col items-stretch gap-3 sm:mx-auto md:max-w-none md:flex-row md:justify-center md:gap-4">
          <button
            onClick={handleShare}
            type="button"
            className="min-h-12 w-full rounded-lg bg-guinness-gold/20 px-6 py-3 text-base font-semibold text-guinness-gold transition-colors hover:bg-guinness-gold/30 active:bg-guinness-gold/40 md:w-56 md:shrink-0"
          >
            {shareSuccess ? "Copied" : "Share score"}
          </button>

          <Link
            to="/"
            viewTransition
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-guinness-gold px-6 py-3 text-center text-base font-semibold text-guinness-black transition-colors hover:bg-guinness-tan active:bg-guinness-tan/90 md:w-56 md:shrink-0"
          >
            Try again
          </Link>

          <LeaderboardButton className="min-h-12 w-full px-6 py-3 text-base font-semibold md:w-56 md:shrink-0" />
        </div>
      </div>

      <BrandedToast
        open={Boolean(scoreToastText)}
        message={scoreToastText}
        variant={scoreToastVariant}
        title={
          scoreToastVariant === "danger"
            ? "Couldn’t complete that"
            : scoreToastVariant === "warning"
              ? "Heads up"
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

    </main>
  );
}
