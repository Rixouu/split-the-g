import type { ReactNode } from "react";
import { useMemo } from "react";
import { useOutletContext } from "react-router";
import { AppLink } from "~/i18n/app-link";
import { useI18n } from "~/i18n/context";
import type { ProfileLayoutOutletContext } from "~/routes/profile/route-outlet-context";
import { BuyCreatorABeer } from "~/components/BuyCreatorABeer";
import { PageHeader, pageShellClass } from "~/components/PageHeader";
import { seoMetaForRoute } from "~/i18n/seo-meta";

const linkClass =
  "text-guinness-gold underline decoration-guinness-gold/40 underline-offset-2 hover:text-guinness-tan";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/faq", "faq");
}

function useFaqItems(t: (key: string) => string): { question: string; answer: ReactNode }[] {
  return useMemo(
    () => [
      {
        question: t("pages.faq.qSplitTheG"),
        answer: <>{t("pages.faq.aSplitTheG")}</>,
      },
      {
        question: t("pages.faq.qWhatAppDoes"),
        answer: (
          <>
            {t("pages.faq.aWhatAppDoesIntro")}{" "}
            <AppLink to="/feed" viewTransition className={linkClass}>
              {t("pages.faq.linkFeed")}
            </AppLink>
            {t("pages.faq.aWhatAppDoesMid1")}{" "}
            <AppLink to="/pubs" viewTransition className={linkClass}>
              {t("pages.faq.linkPubs")}
            </AppLink>{" "}
            {t("pages.faq.aWhatAppDoesMid2")}{" "}
            <AppLink to="/leaderboard" viewTransition className={linkClass}>
              {t("pages.faq.linkLeaderboards")}
            </AppLink>
            {t("pages.faq.aWhatAppDoesMid3")}{" "}
            <AppLink to="/competitions" viewTransition className={linkClass}>
              {t("pages.faq.linkCompetitions")}
            </AppLink>
            {t("pages.faq.aWhatAppDoesOutro")}
          </>
        ),
      },
      {
        question: t("pages.faq.qHowScore"),
        answer: <>{t("pages.faq.aHowScore")}</>,
      },
      {
        question: t("pages.faq.qGuinnessOnly"),
        answer: <>{t("pages.faq.aGuinnessOnly")}</>,
      },
      {
        question: t("pages.faq.qFree"),
        answer: <>{t("pages.faq.aFree")}</>,
      },
      {
        question: t("pages.faq.qGlassTypes"),
        answer: <>{t("pages.faq.aGlassTypes")}</>,
      },
      {
        question: t("pages.faq.qPhotoTips"),
        answer: <>{t("pages.faq.aPhotoTips")}</>,
      },
      {
        question: t("pages.faq.qShareScore"),
        answer: <>{t("pages.faq.aShareScore")}</>,
      },
      {
        question: t("pages.faq.qHigherScore"),
        answer: <>{t("pages.faq.aHigherScore")}</>,
      },
      {
        question: t("pages.faq.qSupport"),
        answer: (
          <>
            <p className="mb-4">{t("pages.faq.aSupport")}</p>
            <div className="flex justify-center pt-2">
              <BuyCreatorABeer />
            </div>
          </>
        ),
      },
    ],
    [t],
  );
}

export default function FAQ() {
  const { t } = useI18n();
  const faqItems = useFaqItems(t);
  const { faqHeaderMode } = useOutletContext<ProfileLayoutOutletContext>() ?? {};
  const compact = faqHeaderMode === "compact";

  const body = (
    <>
      {!compact ? (
        <PageHeader
          title={t("pages.faq.pageTitle")}
          description={t("pages.descriptions.faq")}
        />
      ) : null}

      <div className="flex flex-col gap-3 pb-4">
        {faqItems.map((item) => (
          <details
            key={item.question}
            className="group rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 transition-[border-color,background-color] duration-200 open:border-guinness-gold/35 open:bg-guinness-brown/60"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left [&::-webkit-details-marker]:hidden">
              <span className="pr-2 text-base font-semibold text-guinness-gold sm:text-lg">
                {item.question}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 shrink-0 text-guinness-tan transition-transform duration-300 ease-out group-open:rotate-180"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none group-open:grid-rows-[1fr]">
              <div className="min-h-0 overflow-hidden">
                <div className="type-body border-t border-guinness-gold/15 px-4 pb-4 pt-3 leading-relaxed text-guinness-tan/90">
                  {item.answer}
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );

  if (compact) {
    return <div className="space-y-6">{body}</div>;
  }

  return (
    <div className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>{body}</div>
    </div>
  );
}
