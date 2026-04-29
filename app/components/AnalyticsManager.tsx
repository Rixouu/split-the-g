import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import {
  subscribeToSupabaseAuthChanges,
  useSupabaseAuthUser,
} from "~/utils/supabase-auth";
import { useTChrome } from "~/i18n/context";

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
  const t = useTChrome();
  const location = useLocation();
  const { user } = useSupabaseAuthUser();
  /** Avoid banner flash: SSR and first paint use "pending"; sync from localStorage before paint. */
  const [consentStatus, setConsentStatus] = useState<
    AnalyticsConsentStatus | "pending"
  >("pending");
  const initializedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);
  const lastSignedInEventRef = useRef<{ userId: string; atMs: number } | null>(null);

  useLayoutEffect(() => {
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
    const userId = user?.id ?? null;
    if (userId) {
      const currentUser = user;
      if (!currentUser) return;
      identifyUser(userId);
      previousUserIdRef.current = userId;
      maybeTrackRegistration(currentUser);
      return;
    }
    if (previousUserIdRef.current) {
      resetUser();
      previousUserIdRef.current = null;
    }
  }, [isEnabled, user]);

  useEffect(() => {
    if (!isEnabled) return;
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    void subscribeToSupabaseAuthChanges((event, session) => {
      const nextUser = session?.user ?? null;
      if (!nextUser) return;
      const isNewUser = isWithinNewUserWindow(nextUser);
      const lastSigned = lastSignedInEventRef.current;
      const isDuplicateSignInEvent =
        event === "SIGNED_IN" &&
        lastSigned?.userId === nextUser.id &&
        Date.now() - lastSigned.atMs < SIGNED_IN_TRACK_WINDOW_MS;

      if (event === "SIGNED_IN" && !isDuplicateSignInEvent) {
        trackEvent(analyticsEventNames.authUserSignedIn, {
          method: "google",
          isNewUser,
        });
        lastSignedInEventRef.current = {
          userId: nextUser.id,
          atMs: Date.now(),
        };
      }
      if (isNewUser) maybeTrackRegistration(nextUser);
    }).then((nextUnsubscribe) => {
      if (disposed) {
        nextUnsubscribe();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [isEnabled]);

  if (consentStatus === "pending" || consentStatus !== "unset") return null;

  return (
    <section
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto w-[min(52rem,calc(100vw-1.5rem))] rounded-2xl border border-guinness-gold/30 bg-[linear-gradient(180deg,rgba(10,10,10,0.98),rgba(5,5,5,0.98))] p-4 text-guinness-cream shadow-[0_16px_45px_rgba(0,0,0,0.55)] sm:inset-x-4 sm:bottom-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-guinness-gold/75">
            {t("common.analyticsPrivacyTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-guinness-tan/90 sm:mt-1.5">
            {t("common.analyticsConsentBody")}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            className="min-w-20 rounded-lg border border-guinness-gold/35 px-3 py-2 text-xs font-semibold text-guinness-tan/90 transition-colors hover:bg-guinness-black/60"
            onClick={() => {
              setAnalyticsConsent("rejected");
              setConsentStatus("rejected");
            }}
          >
            {t("common.analyticsReject")}
          </button>
          <button
            type="button"
            className="min-w-20 rounded-lg bg-guinness-gold px-3 py-2 text-xs font-semibold text-guinness-black transition-colors hover:bg-guinness-tan"
            onClick={() => {
              setAnalyticsConsent("accepted");
              setConsentStatus("accepted");
            }}
          >
            {t("common.analyticsAccept")}
          </button>
        </div>
      </div>
    </section>
  );
}
