import { Outlet, useLocation, useRevalidator } from "react-router";
import { AppLink } from "~/i18n/app-link";
import { useCallback, useMemo, useState } from "react";
import {
  EndPageNewPourFooter,
  PageHeader,
  homePourButtonClass,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { BrandedNotice } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import {
  feedbackVariantFromMessage,
  toastAutoCloseForVariant,
} from "~/components/branded/feedback-variant";
import { ProfilePageProvider } from "./profile-context";
import type { ProfileLayoutOutletContext } from "./route-outlet-context";
import {
  SegmentedTabsNav,
  resolveProfileSectionTab,
} from "~/components/ui/segmented-tabs";
import { AchievementUnlockCelebration } from "./achievement-unlock-celebration";
import { ProfileAccountSection } from "./ProfileAccountSection";
import {
  ProfileMobileGuestHub,
  ProfileMobileSignedInHub,
} from "./profile-mobile-dashboard";
import { getCountryOptions } from "~/utils/countryDisplay";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { stripLocalePrefix } from "~/i18n/paths";
import { useIsDesktopMd } from "~/utils/useDesktopMd";
import { useProfileLayoutData } from "./useProfileLayoutData";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/progress", "profile");
}

export default function ProfileLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const revalidator = useRevalidator();
  const profileNavItemsWithFaq = useMemo(
    () =>
      [
        { to: "/profile/account", label: t("pages.profile.navAccount") },
        { to: "/profile/progress", label: t("pages.profile.navProgress") },
        { to: "/profile/achievements", label: t("pages.profile.navAchievements") },
        { to: "/profile/expenses", label: t("pages.profile.navExpenses") },
        { to: "/profile/scores", label: t("pages.profile.navScores") },
        { to: "/profile/favorites", label: t("pages.profile.navFavorites") },
        { to: "/profile/friends", label: t("pages.profile.navFriends") },
        { to: "/profile/faq", label: t("pages.profile.navFaq") },
      ] as const,
    [t],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [toastTitleOverride, setToastTitleOverride] = useState<
    string | undefined
  >();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const hideToast = useCallback(() => {
    setMessage(null);
    setToastTitleOverride(undefined);
  }, []);

  const showToast = useCallback(
    (msg: string | null, explicitTitle?: string) => {
      if (msg === null) {
        hideToast();
        return;
      }
      setMessage(msg);
      setToastTitleOverride(
        explicitTitle !== undefined ? explicitTitle : undefined,
      );
    },
    [hideToast],
  );
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const {
    user,
    loading,
    scores,
    favorites,
    favoriteStats,
    favName,
    setFavName,
    favAddress,
    setFavAddress,
    busy,
    friendEmail,
    setFriendEmail,
    outgoingRequests,
    incomingRequests,
    fullName,
    setFullName,
    nickname,
    setNickname,
    countryCode,
    setCountryCode,
    profileSaving,
    analyticsConsentStatus,
    setAnalyticsConsentStatus,
    progressRange,
    setProgressRange,
    comparisonScores,
    comparisonLabels,
    persistedAchievementCodes,
    profileAchievementsReady,
    streakSnapshot,
    progressStats,
    accountAchievementSummary,
    acceptedFriends,
    friendProgressLeaderboard,
    allTimeFriendStatsByEmail,
    signInGoogle,
    signOutWithToast,
    saveProfile,
    addFavorite,
    removeFavorite,
    sendFriendRequest,
    respondRequest,
    cancelOutgoingFriendRequest,
    removeFriendship,
    inputClass,
  } = useProfileLayoutData({
    hideToast,
    showToast,
    locationPathname: location.pathname,
    locationSearch: location.search,
    revalidate: () => revalidator.revalidate(),
  });

  const profileNavLinkItems = useMemo(
    () =>
      profileNavItemsWithFaq.map(({ to, label }) => ({
        value: to,
        to,
        label,
      })),
    [profileNavItemsWithFaq],
  );

  const profileSectionPaths = useMemo(
    () => profileNavItemsWithFaq.map((i) => i.to),
    [profileNavItemsWithFaq],
  );

  const pathTail =
    stripLocalePrefix(location.pathname).replace(/\/+$/, "") || "/";
  const isProfileHubPath = pathTail === "/profile";
  const isProfileFaqPath = pathTail === "/profile/faq";
  const hideEndPageNewPourFooter = isProfileHubPath || isProfileFaqPath;

  /** Hub path must not resolve to the first tab (Account); use Progress for data hints only. */
  const profileActiveSection = useMemo(() => {
    if (isProfileHubPath) return "/profile/progress";
    return resolveProfileSectionTab(pathTail, profileSectionPaths);
  }, [pathTail, profileSectionPaths, isProfileHubPath]);

  const isDesktop = useIsDesktopMd();
  const isMobileProfileHubDashboard =
    !isDesktop && Boolean(user) && isProfileHubPath && !loading;
  const isMobileProfileGuestHero = !isDesktop && !user && !loading;
  const showProfileHeaderPour =
    !user || isDesktop || isProfileHubPath;
  const mobileSubsectionTitle = useMemo(() => {
    const hit = profileNavItemsWithFaq.find(({ to }) => to === profileActiveSection);
    return hit?.label ?? t("pages.profile.title");
  }, [profileActiveSection, profileNavItemsWithFaq, t]);
  const profileHeaderTitle =
    user && !showProfileHeaderPour
      ? profileActiveSection === "/profile/faq"
        ? t("pages.profile.faqHeaderTitle")
        : mobileSubsectionTitle
      : t("pages.profile.title");
  const profileHeaderDescription =
    user && !showProfileHeaderPour ? undefined : t("pages.descriptions.profile");
  const showAccountFormSection =
    Boolean(user) && profileActiveSection === "/profile/account";
  const profileHeaderBackButtonClass =
    "inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-guinness-gold/35 bg-guinness-black/50 px-4 py-2.5 text-sm font-semibold text-guinness-gold transition-colors hover:border-guinness-gold/55 hover:bg-guinness-brown/40 sm:w-auto sm:px-6 sm:text-base";

  /** Mobile subsection: compact Back, top-right (not full-width). */
  const profileMobileBackTopClass =
    "inline-flex min-h-10 shrink-0 items-center rounded-lg border border-guinness-gold/40 bg-guinness-black/60 px-3.5 py-2 text-sm font-semibold text-guinness-gold shadow-[0_0_0_1px_rgba(212,175,55,0.08)] transition-colors hover:border-guinness-gold/60 hover:bg-guinness-gold/10";

  const countryTriggerClass =
    "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-guinness-gold/25 bg-guinness-black/60 py-2 pl-3 pr-3 text-left text-guinness-cream focus:border-guinness-gold focus:outline-none";

  const messageVariant = message ? feedbackVariantFromMessage(message) : "info";

  const showMobileProfileSubHeader =
    Boolean(user) && !showProfileHeaderPour;
  const hidePageHeaderOnMobile =
    showMobileProfileSubHeader ||
    isMobileProfileHubDashboard ||
    isMobileProfileGuestHero;

  if (isProfileFaqPath) {
    if (loading) {
      return (
        <main className="min-h-screen bg-guinness-black text-guinness-cream">
          <div className={pageShellClass}>
            <p className="type-meta text-guinness-tan/70">
              {t("pages.profile.loading")}
            </p>
          </div>
        </main>
      );
    }
    if (!user) {
      return (
        <main className="min-h-screen bg-guinness-black text-guinness-cream">
          <Outlet
            context={
              { faqHeaderMode: "full" } satisfies ProfileLayoutOutletContext
            }
          />
        </main>
      );
    }
  }

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        {showMobileProfileSubHeader ? (
          <header
            className="mb-6 border-b border-guinness-gold/10 pb-4 md:hidden"
            aria-label={t("pages.profile.ariaProfileSection")}
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 justify-start">
                <AppLink
                  to="/profile"
                  viewTransition
                  className={profileMobileBackTopClass}
                >
                  {t("pages.profile.back")}
                </AppLink>
              </div>
              <h1 className="type-display min-w-0 max-w-[70vw] truncate text-center text-2xl leading-tight text-guinness-gold">
                {mobileSubsectionTitle}
              </h1>
              <div className="min-w-0" aria-hidden />
            </div>
          </header>
        ) : null}

        <PageHeader
          className={hidePageHeaderOnMobile ? "hidden md:flex" : ""}
          title={profileHeaderTitle}
          description={profileHeaderDescription}
        >
          {showProfileHeaderPour ? (
            <AppLink to="/" viewTransition className={pageHeaderActionButtonClass}>
              {t("common.pour")}
            </AppLink>
          ) : (
            <AppLink
              to="/profile"
              viewTransition
              className={profileHeaderBackButtonClass}
            >
              {t("common.back")}
            </AppLink>
          )}
        </PageHeader>

        {loading ? (
          <p className="type-meta text-guinness-tan/70">
            {t("pages.profile.loading")}
          </p>
        ) : !user ? (
          <>
            {isMobileProfileGuestHero ? (
              <ProfileMobileGuestHub
                onSignInGoogle={() => void signInGoogle()}
              />
            ) : null}
            <div
              className={`rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 p-6 ${isMobileProfileGuestHero ? "hidden md:block" : ""}`}
            >
              <p className="type-meta mb-4 text-guinness-tan/85">
                {t("pages.profile.signInBlurb")}
              </p>
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className="w-full rounded-lg border border-guinness-gold/45 bg-guinness-gold/15 py-3 font-semibold text-guinness-cream transition-colors hover:border-guinness-gold/70 hover:bg-guinness-gold/25"
              >
                {t("pages.profile.signInGoogle")}
              </button>
              <p className="type-meta mt-5 text-center text-guinness-tan/75">
                <AppLink
                  to="/profile/faq"
                  prefetch="intent"
                  viewTransition
                  className="font-semibold text-guinness-gold underline decoration-guinness-gold/35 underline-offset-2 hover:text-guinness-tan"
                >
                  {t("pages.profile.navFaq")}
                </AppLink>
                <span className="text-guinness-tan/55">
                  {t("pages.profile.faqLinkBlurb")}
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-8">
            <ProfilePageProvider
              value={{
                user,
                scores,
                favorites,
                favoriteStats,
                progressStats,
                progressRange,
                setProgressRange,
                friendProgressLeaderboard,
                friendEmail,
                setFriendEmail,
                sendFriendRequest,
                acceptedFriends,
                incomingRequests,
                outgoingRequests,
                busy,
                favName,
                setFavName,
                favAddress,
                setFavAddress,
                addFavorite,
                removeFavorite,
                respondRequest,
                cancelOutgoingFriendRequest,
                removeFriendship,
                allTimeFriendStatsByEmail,
                persistedAchievementCodes,
                streakSnapshot,
                inputClass,
                showProfileToast: (message: string, title?: string) => {
                  showToast(message, title);
                },
              }}
            >
              {user && isProfileHubPath ? (
                isMobileProfileHubDashboard ? (
                  <ProfileMobileSignedInHub
                    user={user}
                    fullName={fullName}
                    nickname={nickname}
                    countryCode={countryCode}
                    scores={scores}
                    favorites={favorites}
                    acceptedFriends={acceptedFriends}
                    comparisonScores={comparisonScores}
                    comparisonLabels={comparisonLabels}
                    incomingFriendRequestCount={incomingRequests.length}
                    outgoingFriendPendingCount={outgoingRequests.length}
                    persistedAchievementCodes={persistedAchievementCodes}
                    streakSnapshot={streakSnapshot}
                  />
                ) : (
                  <nav
                    className="md:hidden"
                    aria-label={t("pages.profile.ariaProfileSections")}
                  >
                    <ul className="space-y-2">
                      {profileNavItemsWithFaq.map(({ to, label }) => (
                        <li key={to}>
                          <AppLink
                            to={to}
                            prefetch="intent"
                            viewTransition
                            className="flex min-h-[3.25rem] items-center justify-between gap-3 rounded-xl border border-guinness-gold/20 bg-guinness-brown/35 px-4 py-3 text-guinness-cream transition-colors active:bg-guinness-brown/50 hover:border-guinness-gold/40"
                          >
                            <span className="text-[15px] font-semibold">{label}</span>
                            <span className="text-guinness-gold" aria-hidden>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-5 w-5 opacity-80"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          </AppLink>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )
              ) : null}

              <SegmentedTabsNav
                items={profileNavLinkItems}
                activeValue={profileActiveSection}
                layoutClassName="hidden md:grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
                aria-label={t("pages.profile.ariaProfileSections")}
              />

              {showAccountFormSection ? (
                <ProfileAccountSection
                  user={user}
                  fullName={fullName}
                  setFullName={setFullName}
                  nickname={nickname}
                  setNickname={setNickname}
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  profileSaving={profileSaving}
                  onSaveProfile={saveProfile}
                  countryOptions={countryOptions}
                  countryTriggerClass={countryTriggerClass}
                  analyticsConsentStatus={analyticsConsentStatus}
                  setAnalyticsConsentStatus={setAnalyticsConsentStatus}
                  showToast={showToast}
                  onOpenSignOutConfirm={() => setSignOutConfirmOpen(true)}
                  inputClass={inputClass}
                  accountAchievementSummary={accountAchievementSummary}
                />
              ) : null}

              <div className={isProfileHubPath ? "md:mt-6" : "mt-6"}>
                <Outlet
                  context={
                    { faqHeaderMode: "compact" } satisfies ProfileLayoutOutletContext
                  }
                />
              </div>
            </ProfilePageProvider>
          </div>
        )}

        <AchievementUnlockCelebration
          userId={user?.id ?? null}
          persistedAchievementCodes={persistedAchievementCodes}
          profileDataReady={profileAchievementsReady && Boolean(user)}
          showToast={showToast}
        />

        <BrandedToast
          open={Boolean(message)}
          message={message ?? ""}
          variant={messageVariant}
          title={
            toastTitleOverride ??
            (messageVariant === "danger"
              ? t("toasts.toastDangerTitle")
              : messageVariant === "warning"
                ? t("toasts.toastWarningTitle")
                : messageVariant === "info"
                  ? t("toasts.toastInfoTitle")
                  : undefined)
          }
          onClose={hideToast}
          autoCloseMs={toastAutoCloseForVariant(messageVariant)}
        />

        <BrandedNotice
          open={signOutConfirmOpen}
          onOpenChange={setSignOutConfirmOpen}
          title={t("pages.profile.signOutConfirmTitle")}
          description={t("pages.profile.signOutConfirmDescription")}
          variant="warning"
          secondaryLabel={t("pages.profile.staySignedIn")}
          primaryLabel={t("pages.profile.signOut")}
          onPrimary={async () => {
            setSignOutConfirmOpen(false);
            await signOutWithToast();
          }}
        />

        {showMobileProfileSubHeader ? (
          <>
            <div className="mt-10 flex justify-center pb-6 md:hidden">
              <AppLink
                to="/profile"
                viewTransition
                className={homePourButtonClass}
              >
                {t("pages.profile.back")}
              </AppLink>
            </div>
            {!hideEndPageNewPourFooter ? (
              <div className="hidden md:block">
                <EndPageNewPourFooter />
              </div>
            ) : null}
          </>
        ) : !hideEndPageNewPourFooter ? (
          <EndPageNewPourFooter />
        ) : null}
      </div>
    </main>
  );
}
