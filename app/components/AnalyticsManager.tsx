import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import type { User } from "@supabase/supabase-js";
import { captureAttributionFromCurrentUrl } from "~/utils/analytics/attribution";
import {
  identifyUser,
  initializeAnalytics,
  resetUser,
  trackEvent,
  trackPageView,
} from "~/utils/analytics/client";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsentStatus,
} from "~/utils/analytics/consent";
import { analyticsEventNames } from "~/utils/analytics/events";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";

interface AnalyticsManagerProps {
  gaMeasurementId?: string;
  posthogKey?: string;
  posthogHost?: string;
  lang?: string;
}

const REGISTERED_TRACKED_KEY_PREFIX = "stg_analytics_registered_tracked_";
const NEW_USER_WINDOW_MS = 15 * 60 * 1000;
const SIGNED_IN_TRACK_WINDOW_MS = 10 * 1000;

function maybeTrackRegistration(user: User) {
  if (typeof window === "undefined") return;
  const trackedKey = `${REGISTERED_TRACKED_KEY_PREFIX}${user.id}`;
  if (window.localStorage.getItem(trackedKey) === "1") return;
  const createdMs = Date.parse(user.created_at ?? "");
  if (!Number.isFinite(createdMs)) return;
  const ageMs = Date.now() - createdMs;
  if (ageMs < 0 || ageMs > NEW_USER_WINDOW_MS) return;
  trackEvent(analyticsEventNames.authUserRegistered, { method: "google" });
  window.localStorage.setItem(trackedKey, "1");
}

function isWithinNewUserWindow(user: User): boolean {
  const createdMs = Date.parse(user.created_at ?? "");
  if (!Number.isFinite(createdMs)) return false;
  const ageMs = Date.now() - createdMs;
  return ageMs >= 0 && ageMs <= NEW_USER_WINDOW_MS;
}

export function AnalyticsManager({
  gaMeasurementId,
  posthogKey,
  posthogHost,
  lang,
}: AnalyticsManagerProps) {
  const location = useLocation();
  const [consentStatus, setConsentStatus] = useState<AnalyticsConsentStatus>("unset");
  const initializedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);
  const lastSignedInEventRef = useRef<{ userId: string; atMs: number } | null>(null);

  useEffect(() => {
    setConsentStatus(getAnalyticsConsent());
  }, []);

  const isEnabled = consentStatus === "accepted";

  useEffect(() => {
    if (!isEnabled || initializedRef.current) return;
    initializeAnalytics({
      enabled: true,
      gaMeasurementId,
      posthogKey,
      posthogHost,
    });
    initializedRef.current = true;
  }, [gaMeasurementId, isEnabled, posthogHost, posthogKey]);

  useEffect(() => {
    captureAttributionFromCurrentUrl(location.search);
  }, [location.search]);

  useEffect(() => {
    if (!isEnabled) return;
    trackPageView({
      path: `${location.pathname}${location.search}`,
      title: typeof document !== "undefined" ? document.title : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      lang,
    });
  }, [isEnabled, lang, location.pathname, location.search]);

  useEffect(() => {
    if (!isEnabled) {
      if (previousUserIdRef.current) {
        resetUser();
        previousUserIdRef.current = null;
      }
      return;
    }
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const userId = data.user?.id ?? null;
      if (userId) {
        identifyUser(userId);
        previousUserIdRef.current = userId;
        if (data.user) maybeTrackRegistration(data.user);
      }
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        const nextUserId = session?.user?.id ?? null;
        if (nextUserId) {
          identifyUser(nextUserId);
          previousUserIdRef.current = nextUserId;
          if (session?.user) {
            const isNewUser = isWithinNewUserWindow(session.user);
            const lastSigned = lastSignedInEventRef.current;
            const isDuplicateSignInEvent =
              event === "SIGNED_IN" &&
              lastSigned?.userId === session.user.id &&
              Date.now() - lastSigned.atMs < SIGNED_IN_TRACK_WINDOW_MS;

            if (event === "SIGNED_IN" && !isDuplicateSignInEvent) {
              trackEvent(analyticsEventNames.authUserSignedIn, {
                method: "google",
                isNewUser,
              });
              lastSignedInEventRef.current = {
                userId: session.user.id,
                atMs: Date.now(),
              };
            }
            if (isNewUser) maybeTrackRegistration(session.user);
          }
        } else if (previousUserIdRef.current) {
          resetUser();
          previousUserIdRef.current = null;
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [isEnabled]);

  if (consentStatus !== "unset") return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-xl rounded-xl border border-guinness-gold/35 bg-guinness-black/95 p-4 text-guinness-cream shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
      <p className="text-sm text-guinness-tan/90">
        We use analytics to improve pour scoring, competition flows, and app
        performance.
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-guinness-gold/35 px-3 py-2 text-xs font-semibold text-guinness-tan/90 transition-colors hover:bg-guinness-black/60"
          onClick={() => {
            setAnalyticsConsent("rejected");
            setConsentStatus("rejected");
          }}
        >
          Reject
        </button>
        <button
          type="button"
          className="rounded-md bg-guinness-gold px-3 py-2 text-xs font-semibold text-guinness-black transition-colors hover:bg-guinness-tan"
          onClick={() => {
            setAnalyticsConsent("accepted");
            setConsentStatus("accepted");
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
