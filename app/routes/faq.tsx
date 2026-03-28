import type { ReactNode } from "react";
import { Link } from "react-router";
import { BuyCreatorABeer } from "~/components/BuyCreatorABeer";
import {
  PageHeader,
  faqPageDescription,
  homePourButtonClass,
  pageShellClass,
} from "~/components/PageHeader";

export function meta() {
  return [
    { title: "FAQ — Split the G" },
    {
      name: "description",
      content:
        "Frequently asked questions about Split the G: scoring your pour, pubs, competitions, accounts, and supporting the project.",
    },
  ];
}

const faqItems: { question: string; answer: ReactNode }[] = [
  {
    question: 'What is "Split the G"?',
    answer: (
      <>
        &quot;Split the G&quot; is the Guinness challenge where you sip your pint
        so the foam line lands in the middle of the &quot;G&quot; in the harp
        logo. It&apos;s part skill, part steady hands, and part luck.
      </>
    ),
  },
  {
    question: "What does this app do?",
    answer: (
      <>
        Split the G is a web app for scoring that pour. You take a photo on the
        home screen; the app estimates how close you are to a perfect split and
        gives you a score from 0 to 5. You can browse the{" "}
        <Link to="/feed" viewTransition className="text-guinness-gold underline decoration-guinness-gold/40 underline-offset-2 hover:text-guinness-tan">
          feed
        </Link>
        , open any pour for details, explore{" "}
        <Link to="/pubs" viewTransition className="text-guinness-gold underline decoration-guinness-gold/40 underline-offset-2 hover:text-guinness-tan">
          pubs
        </Link>{" "}
        (with a wall of pours per venue), check{" "}
        <Link to="/leaderboard" viewTransition className="text-guinness-gold underline decoration-guinness-gold/40 underline-offset-2 hover:text-guinness-tan">
          leaderboards
        </Link>
        , and join{" "}
        <Link to="/competitions" viewTransition className="text-guinness-gold underline decoration-guinness-gold/40 underline-offset-2 hover:text-guinness-tan">
          competitions
        </Link>
        . Sign in with Google from Profile when you want a saved profile,
        friends, favorites, and competition invites.
      </>
    ),
  },
  {
    question: "How does the app score my pint?",
    answer: (
      <>
        The app looks for a Guinness pint glass and logo in your photo, then
        compares where the foam line sits relative to the center of the
        &quot;G&quot;. That becomes a score from 0 (way off) to 5 (as close as the
        model can tell). Results depend on lighting, angle, and image quality —
        it&apos;s a fun guide, not a lab measurement.
      </>
    ),
  },
  {
    question: "Do I have to drink Guinness to use the app?",
    answer: (
      <>
        Yes. Scoring is built around the standard Guinness glass and harp logo.
        Other beers or glass shapes aren&apos;t supported.
      </>
    ),
  },
  {
    question: "Is the app free?",
    answer: (
      <>
        Yes. There are no paywalls for pouring, browsing, or competitions, and
        no ads in the app today.
      </>
    ),
  },
  {
    question: "Can I use older or non-standard Guinness glasses?",
    answer: (
      <>
        The model is trained on the familiar curved pint with a clear
        &quot;G&quot;. Etched, faded, or unusual glassware may score less
        reliably. Better photos usually help more than a perfect glass.
      </>
    ),
  },
  {
    question: "How should I take the photo?",
    answer: (
      <>
        Face the glass straight-on so the full harp and foam line are visible.
        Avoid harsh glare and very dark corners. The home screen uses your
        device camera with an overlay to help you line things up before you
        capture.
      </>
    ),
  },
  {
    question: "Can I share my score?",
    answer: (
      <>
        Each pour has its own page you can link to. Copy the URL from the
        address bar after you submit, or screenshot your result — share it
        anywhere you like (group chat, socials, etc.).
      </>
    ),
  },
  {
    question: "How can I get a higher score?",
    answer: (
      <>
        Start with a well-poured pint, then sip slowly and stop when the line
        looks centered on the &quot;G&quot;. Small adjustments beat big gulps.
        If the model seems off, try a clearer, straighter photo next time.
      </>
    ),
  },
  {
    question: "How can I support the creator?",
    answer: (
      <>
        <p className="mb-4">
          Split the G is a solo project and free to use. If it&apos;s been fun
          for you and you&apos;d like to say thanks, you can buy the creator a
          beer — it helps cover hosting, APIs, and time spent improving the app.
        </p>
        <div className="flex justify-center pt-2">
          <BuyCreatorABeer />
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
          description={faqPageDescription}
        />

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

        <div className="mt-10 flex justify-center pb-6">
          <Link to="/" viewTransition className={homePourButtonClass}>
            New Pour
          </Link>
        </div>
      </div>
    </main>
  );
}
