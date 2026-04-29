import { useState } from "react";
import { Zap, ZapOff } from "lucide-react";
import { AppDocumentLink } from "~/i18n/app-link";
import { PintGlassOverlay } from "~/components/PintGlassOverlay";
import { SplitTheGLogo } from "~/components/SplitTheGLogo";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useI18n } from "~/i18n/context";
import { langFromParams } from "~/i18n/lang-param";
import { BuyCreatorABeer } from "~/components/BuyCreatorABeer";
import { PwaInstallBanner } from "~/components/pwa-install-banner";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { handleHomePourAction } from "./home-pour.server";
import { useHomePourClient } from "./useHomePourClient";

/** Compact mobile browse links — avoids full-width gold blocks on small screens. */
const homeMobileBrowseLinkClass =
  "inline-flex min-h-9 w-full items-center justify-center rounded-md border border-guinness-gold/30 bg-guinness-black/40 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-guinness-gold transition-colors hover:border-guinness-gold/50 hover:bg-guinness-gold/10 active:bg-guinness-gold/15";

export async function loader(_args: LoaderFunctionArgs) {
  return {};
}

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/", "home");
}

/** Vercel: long-running pour action (Roboflow + uploads + DB). */
export const config = {
  maxDuration: 60,
};

export async function action({ request, params }: ActionFunctionArgs) {
  return handleHomePourAction({
    request,
    lang: langFromParams(params),
  });
}

export default function Home() {
  const { t } = useI18n();
  const {
    isCameraActive,
    isFlashSupported,
    isFlashEnabled,
    isFlashUpdating,
    videoRef,
    canvasRef,
    fileInputRef,
    feedbackMessage,
    isProcessing,
    isSubmitting,
    isUploadProcessing,
    showNoGModal,
    homeToast,
    toggleFlash,
    handleStartCamera,
    handleVideoLoadedMetadata,
    handleVideoError,
    handleUploadInstead,
    handleFileChange,
    closeNoGModal,
    dismissHomeToast,
  } = useHomePourClient({ t });
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-start overflow-x-hidden bg-guinness-black text-guinness-cream max-lg:overflow-y-auto lg:max-h-dvh lg:min-h-0 lg:overflow-y-auto">
      <PwaInstallBanner />
      {isUploadProcessing && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="type-section text-xl">
            {t("pages.home.processingImage")}
          </p>
          <p className="type-meta">
            {t("pages.home.moment")}
          </p>
        </div>
      )}

      {showNoGModal && (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="bg-guinness-black/90 backdrop-blur-sm border border-guinness-gold/20 rounded-lg p-8 max-w-md mx-4 text-center">
            <p className="type-section mb-4">
              {t("errors.noGDetected")}
            </p>
            <p className="type-meta mb-6">
              {t("pages.home.noGModalBody")}
            </p>
            <button
              type="button"
              onClick={closeNoGModal}
              className="px-6 py-2 bg-guinness-gold text-guinness-black rounded-lg hover:bg-guinness-tan transition-colors duration-300"
            >
              {t("common.tryAgain")}
            </button>
          </div>
        </div>
      )}

      {isSubmitting ? (
        <div className="fixed inset-0 bg-guinness-black/95 flex flex-col items-center justify-center gap-6 z-50">
          <div className="w-24 h-24 border-4 border-guinness-gold/20 border-t-guinness-gold rounded-full animate-spin"></div>
          <p className="type-section text-xl">
            {t("pages.home.analyzingSplit")}
          </p>
          <p className="type-meta">
            {t("pages.home.moment")}
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-4 max-lg:pb-[max(6.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-5 lg:min-h-0 lg:flex-1 lg:overflow-visible lg:px-8 lg:pb-5 lg:pt-[4.5rem]">
          <h1 className="sr-only">{t("pages.home.srTitle")}</h1>

          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-x-10 lg:gap-y-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)] xl:gap-x-12">
            <aside className="flex min-w-0 shrink-0 flex-col items-center gap-4 text-center lg:items-start lg:gap-8 lg:pr-2 lg:pt-0 lg:text-left xl:gap-9">
              <div className="flex w-full flex-col items-center gap-0 max-lg:mt-3 lg:mt-0 lg:items-start lg:gap-5">
                <div className="flex w-full justify-center lg:justify-start">
                  <SplitTheGLogo className="max-w-[min(82vw,14rem)] lg:max-w-[18rem] xl:max-w-[19rem]" />
                </div>
                <div
                  className="mt-3 h-[2px] w-[min(72%,11.5rem)] rounded-full bg-gradient-to-r from-guinness-gold/65 via-guinness-tan/35 to-transparent lg:mt-0 lg:h-px lg:w-[min(88%,13.5rem)] lg:from-guinness-gold/55 lg:via-guinness-gold/28 lg:to-transparent"
                  aria-hidden
                />
              </div>
              <div className="flex w-full max-w-sm flex-col gap-2.5 lg:max-w-[23rem] lg:gap-3">
                <h2 className="text-base font-medium leading-snug tracking-tight text-guinness-gold sm:text-[1.0625rem] lg:text-lg lg:leading-tight xl:text-xl">
                  {t("pages.home.tagline")}
                </h2>
                <p className="text-[13px] leading-relaxed text-guinness-tan/70 sm:text-sm lg:text-[0.9375rem] lg:leading-[1.65] lg:text-guinness-tan/68">
                  {t("pages.home.subtitle")}
                </p>
              </div>
              <nav
                aria-label={t("pages.home.browseAria")}
                className="flex w-full max-w-sm flex-col items-stretch gap-2 lg:mt-2 lg:max-w-none"
              >
                <div className="mx-auto grid w-full max-w-[17.5rem] grid-cols-2 gap-2 lg:hidden">
                  <AppDocumentLink
                    to="/leaderboard"
                    prefetch="intent"
                    viewTransition
                    className={homeMobileBrowseLinkClass}
                  >
                    {t("pages.home.topSplits")}
                  </AppDocumentLink>
                  <AppDocumentLink
                    to="/wall"
                    prefetch="intent"
                    viewTransition
                    className={homeMobileBrowseLinkClass}
                  >
                    {t("pages.home.wall")}
                  </AppDocumentLink>
                </div>
                <div className="hidden items-center gap-2 text-sm text-guinness-tan/65 lg:flex">
                  <AppDocumentLink
                    to="/leaderboard"
                    prefetch="intent"
                    viewTransition
                    className="font-medium text-guinness-tan/88 underline decoration-guinness-tan/20 underline-offset-[3px] transition-colors hover:text-guinness-gold hover:decoration-guinness-gold/40"
                  >
                    {t("pages.home.topSplits")}
                  </AppDocumentLink>
                  <span className="text-guinness-tan/28" aria-hidden>
                    ·
                  </span>
                  <AppDocumentLink
                    to="/wall"
                    prefetch="intent"
                    viewTransition
                    className="font-medium text-guinness-tan/88 underline decoration-guinness-tan/20 underline-offset-[3px] transition-colors hover:text-guinness-gold hover:decoration-guinness-gold/40"
                  >
                    {t("pages.home.theWall")}
                  </AppDocumentLink>
                </div>
              </nav>

              <div className="mt-3 w-full max-w-sm overflow-hidden rounded-xl border border-[#312814] bg-guinness-brown/12 text-left lg:mt-6 lg:max-w-[23rem] lg:rounded-none lg:border-0 lg:bg-transparent lg:overflow-visible">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 border-b border-[#312814]/45 px-3 py-2.5 text-left transition-colors hover:bg-guinness-black/20 lg:hidden"
                  aria-expanded={howItWorksOpen ? "true" : "false"}
                  onClick={() => setHowItWorksOpen((o) => !o)}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-guinness-tan/50">
                    {t("pages.home.howItWorks")}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-guinness-gold/70 transition-transform duration-200 ${howItWorksOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div className="hidden lg:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/32">
                    {t("pages.home.howItWorks")}
                  </p>
                  <div
                    className="mt-3 h-px w-[min(11rem,72%)] bg-gradient-to-r from-guinness-gold/28 via-guinness-tan/12 to-transparent"
                    aria-hidden
                  />
                </div>
                <ul
                  className={`space-y-2.5 px-3.5 pb-4 pt-3 text-[11px] leading-relaxed text-guinness-tan/75 sm:text-xs max-lg:mt-0 lg:mt-5 lg:space-y-3.5 lg:px-0 lg:pb-0 lg:pt-0 lg:text-[12px] lg:leading-relaxed lg:text-guinness-tan/60 ${howItWorksOpen ? "block" : "hidden"} lg:block`}
                >
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      1
                    </span>
                    <span>{t("pages.home.step1")}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      2
                    </span>
                    <span>{t("pages.home.step2")}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums leading-[1.5] text-guinness-gold/88 lg:font-medium lg:text-guinness-gold/42">
                      3
                    </span>
                    <span>{t("pages.home.step3")}</span>
                  </li>
                </ul>
              </div>
            </aside>

            <section
              className="mx-auto flex w-full min-h-0 max-w-md flex-1 flex-col gap-2 sm:max-w-lg lg:mx-0 lg:max-h-full lg:min-h-0 lg:w-full lg:max-w-none lg:justify-self-stretch"
              aria-label={t("pages.home.scoreYourPour")}
            >
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/42 max-lg:pb-0 lg:hidden">
                {t("pages.home.scoreYourPour")}
              </p>
              <div className="hidden w-full flex-row items-baseline justify-between gap-4 lg:flex">
                <p className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-guinness-tan/42">
                  {t("pages.home.scoreYourPour")}
                </p>
                <BuyCreatorABeer variant="compact" className="shrink-0 text-sm" />
              </div>

              {isCameraActive && (
                <div className="shrink-0 rounded-xl border border-[#312814] bg-guinness-brown/35 px-4 py-3 text-guinness-gold shadow-[inset_0_1px_0_rgba(212,175,55,0.05)] backdrop-blur-sm lg:px-4 lg:py-2.5">
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="type-label text-guinness-gold">
                        {feedbackMessage}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span className="type-label text-guinness-gold">
                        {feedbackMessage}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[#312814] bg-guinness-brown/30 shadow-[inset_0_1px_0_rgba(212,175,55,0.06),0_12px_40px_rgba(0,0,0,0.45)] max-lg:min-h-[min(56dvh,26rem)] lg:aspect-auto lg:min-h-[min(34rem,calc(100dvh-10rem))] lg:max-h-[min(44rem,calc(100dvh-7.5rem))]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_38%,rgba(179,139,45,0.12)_0%,transparent_62%)]"
                  aria-hidden
                />
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {isCameraActive ? (
                    <div className="relative min-h-0 flex-1">
                      {isFlashSupported ? (
                        <button
                          type="button"
                          onClick={() => void toggleFlash()}
                          disabled={isFlashUpdating}
                          aria-pressed={isFlashEnabled ? "true" : "false"}
                          className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-guinness-gold/35 bg-guinness-black/65 px-3 py-1.5 text-xs font-semibold text-guinness-gold backdrop-blur-sm transition-colors hover:bg-guinness-black/80 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isFlashEnabled ? (
                            <Zap className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ZapOff className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {isFlashEnabled
                            ? t("pages.home.flashOn")
                            : t("pages.home.flashOff")}
                        </button>
                      ) : null}
                      <video
                        ref={videoRef}
                        className="absolute inset-0 h-full w-full object-cover"
                        autoPlay
                        playsInline
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onError={handleVideoError}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex translate-y-3 items-center justify-center sm:translate-y-4 lg:translate-y-3">
                        {/*
                          Uniform scale only: fixed max-height + w:auto preserves the
                          SVG viewBox 400:600 aspect ratio (no skew transforms).
                        */}
                        <PintGlassOverlay className="block h-[min(20rem,52dvh)] w-auto shrink-0 text-guinness-gold opacity-50 sm:h-[min(22rem,50dvh)] lg:h-[min(23rem,min(48dvh,calc(100dvh-12rem)))]" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartCamera}
                      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-guinness-gold transition-colors duration-300 hover:text-guinness-tan sm:gap-2.5 sm:py-8 lg:gap-2.5 lg:py-8"
                    >
                      <span
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#312814] bg-guinness-black/35 shadow-[inset_0_1px_0_rgba(212,175,55,0.08)] sm:h-[4.5rem] sm:w-[4.5rem] lg:h-14 lg:w-14"
                        aria-hidden
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 sm:h-9 sm:w-9"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </span>
                      <span className="text-base font-semibold tracking-tight sm:text-lg lg:text-base">
                        {t("pages.home.startAnalysis")}
                      </span>
                      <span className="type-meta max-w-[17rem] px-2 text-center text-[12px] text-guinness-tan/55 sm:text-[13px] lg:max-w-[15rem] lg:text-xs lg:leading-snug">
                        {t("pages.home.startAnalysisHint")}
                      </span>
                    </button>
                  )}
                  <div className="relative z-10 shrink-0 border-t border-[#312814] bg-guinness-black/30 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={handleUploadInstead}
                      className="flex min-h-10 w-full items-center justify-center rounded-lg border border-[#312814] bg-guinness-black/25 px-3 py-2 text-xs font-semibold text-guinness-tan/90 transition-colors duration-300 hover:border-guinness-gold/35 hover:bg-[#312814]/40 hover:text-guinness-cream sm:text-sm"
                    >
                      {t("pages.home.uploadPhoto")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-1 max-lg:pt-2 lg:hidden">
                <BuyCreatorABeer variant="compact" className="text-xs" />
              </div>

              <input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label={t("pages.home.uploadAria")}
                title={t("pages.home.uploadAria")}
                onChange={handleFileChange}
                className="hidden"
              />
            </section>
          </div>
        </div>
      )}

      <BrandedToast
        open={homeToast != null}
        message={homeToast?.message ?? ""}
        variant={homeToast?.variant ?? "info"}
        title={
          homeToast?.variant === "danger"
            ? t("common.couldntProcessImage")
            : homeToast?.variant === "warning"
              ? t("common.headsUp")
              : undefined
        }
        onClose={dismissHomeToast}
        autoCloseMs={
          homeToast ? toastAutoCloseForVariant(homeToast.variant) : undefined
        }
      />
    </main>
  );
}
