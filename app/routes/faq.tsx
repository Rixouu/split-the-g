import type { ReactNode } from "react";
import { Link } from "react-router";
import { BuyCreatorsABeer } from "~/components/BuyCreatorsABeer";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
  standardPageDescription,
} from "~/components/PageHeader";

export function meta() {
  return [
    { title: "FAQ — Split the G App" },
    {
      name: "description",
      content:
        "Frequently asked questions about the Split the G app and challenge",
    },
  ];
}

const faqItems: { question: string; answer: ReactNode }[] = [
  {
    question: 'What is "Split the G"?',
    answer: (
      <>
        &quot;Split the G&quot; is a popular drinking challenge where you try to
        sip your pint of Guinness so that the foam line stops exactly in the
        middle of the &quot;G&quot; in the Guinness logo. It takes precision,
        patience, and a bit of luck.
      </>
    ),
  },
  {
    question: "What does the Split the G app do?",
    answer: (
      <>
        Our app lets you snap a photo of your Guinness pint and uses computer
        vision to score how well you split the G. It&apos;s a fun way to compete
        with friends, settle debates, and track your perfect pours.
      </>
    ),
  },
  {
    question: "How does the app score my pint?",
    answer: (
      <>
        We analyze your photo to detect the Guinness glass and logo, then
        measure how close the foam line is to the center of the
        &quot;G&quot;. You&apos;ll get a score from 0 to 5 — the closer to a
        perfect split, the higher the score.
      </>
    ),
  },
  {
    question: "Do I have to drink Guinness to use the app?",
    answer: (
      <>
        Yes — the app is specifically built to detect the Guinness glass and
        logo. Other drinks or glassware won&apos;t work (yet!).
      </>
    ),
  },
  {
    question: "Is the app free?",
    answer: (
      <>
        Yep! The app is entirely free to use, with no ads. Premium features may
        come in the future, but the core &quot;Split the G&quot; experience is
        always free.
      </>
    ),
  },
  {
    question: "Can I use the app with older Guinness glasses?",
    answer: (
      <>
        The app works best with the modern Guinness pint glass with a clear
        &quot;G&quot; logo. Older or worn glasses might not be recognized as
        accurately, but we&apos;re always improving the model.
      </>
    ),
  },
  {
    question: "Do I need to take the photo at a certain angle?",
    answer: (
      <>
        Try to take the photo straight-on, with the full logo and foam line
        visible. Good lighting helps too. We&apos;ll guide you with tips in the
        app before snapping a pic.
      </>
    ),
  },
  {
    question: "Can I share my score?",
    answer: (
      <>
        Yes! After getting your score, you can share to Instagram, TikTok, or
        group chat — let the bragging begin. Feel free to tag us on Instagram
        or X with your score.
      </>
    ),
  },
  {
    question: "How can I improve my Split the G score?",
    answer: (
      <>
        Steady hands, a well-poured pint, and a bit of practice. Take your time
        and aim for that clean, precise sip. We believe in you.
      </>
    ),
  },
  {
    question: "How can I support the creators?",
    answer: (
      <>
        <p className="mb-4">
          This app is completely free, but if you&apos;re enjoying Split the G
          and want to show your appreciation, you can buy the creators a beer.
          Your support helps us keep the app running and develop new features.
        </p>
        <div className="flex justify-center pt-2">
          <BuyCreatorsABeer />
        </div>
      </>
    ),
  },
];

export default function FAQ() {
  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title="Frequently asked questions"
          description={standardPageDescription}
        >
          <Link to="/" className={pageHeaderActionButtonClass}>
            Back to Split
          </Link>
        </PageHeader>

        <div className="flex flex-col gap-3 pb-4">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-lg border border-guinness-gold/20 bg-guinness-brown/40 transition-colors open:border-guinness-gold/35 open:bg-guinness-brown/60"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left [&::-webkit-details-marker]:hidden">
                <span className="pr-2 text-base font-semibold text-guinness-gold sm:text-lg">
                  {item.question}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5 flex-shrink-0 text-guinness-tan transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div className="type-body border-t border-guinness-gold/15 px-4 pb-4 pt-3 leading-relaxed text-guinness-tan/90">
                {item.answer}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 flex justify-center pb-8">
          <Link to="/" className={`${pageHeaderActionButtonClass} w-full max-w-xs sm:w-auto`}>
            Back to Split
          </Link>
        </div>
      </div>
    </main>
  );
}
