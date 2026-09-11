import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy | Split The G" },
  {
    name: "description",
    content: "How Split The G collects, uses, shares, and protects your information.",
  },
];

const sectionClass = "space-y-3";
const headingClass = "text-xl font-semibold text-[#d4af57]";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-dvh bg-[#050608] px-5 py-12 text-[#f4efe6]">
      <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-[#d4af57]/25 bg-[#0d0d0e] p-6 shadow-2xl sm:p-10">
        <header className="space-y-3 border-b border-[#d4af57]/20 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d4af57]">
            Split The G
          </p>
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-[#b8aa94]">Last updated September 11, 2026</p>
        </header>

        <section className={sectionClass}>
          <h2 className={headingClass}>What we collect</h2>
          <p>
            We collect information you provide, including your email address, display name,
            profile details, friend and competition activity, venue details, ratings, and pint
            photos you submit. If you choose to add a location or price to a pour, we collect that
            information as part of the submission.
          </p>
          <p>
            We also collect limited technical and usage information, such as app events, device
            and browser details, crash or diagnostic information, and a session identifier used to
            associate an unauthenticated pour with your device.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Camera, photos, and location</h2>
          <p>
            Camera and photo-library access is used only when you choose to capture or select a
            pint image. The selected image is sent securely to our analysis service to score the
            pour and may be stored when you save or share it. Location access is optional and is
            used to help confirm or attach a venue to a pour.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>How we use information</h2>
          <p>
            We use information to provide pour analysis, maintain accounts and profiles, display
            community content, operate competitions and leaderboards, find nearby pubs, secure the
            service, respond to support requests, and understand and improve product performance.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Service providers and public content</h2>
          <p>
            We use service providers for authentication and data hosting, image analysis, maps,
            analytics, hosting, and app distribution. These include Supabase, Roboflow, Google,
            PostHog, Vercel, and Apple. They process information only to provide their services to
            us and under their own applicable privacy terms.
          </p>
          <p>
            Pours, photos, profile names, scores, ratings, comments, venue associations, and
            competition activity that you choose to share can be visible to other users. Do not
            submit information you do not want displayed publicly.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Retention and your choices</h2>
          <p>
            We retain information while your account is active and as reasonably needed to operate
            the service, comply with legal obligations, resolve disputes, and prevent abuse. You
            can edit profile information in the app and permanently delete your account and
            associated data from Profile → Account → Delete account.
          </p>
          <p>
            You can withdraw camera, photo, notification, or location permission at any time in
            your device settings. You may also contact us to request access to, correction of, or
            deletion of your information.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Children and responsible use</h2>
          <p>
            Split The G is intended for people of legal drinking age in their country or region.
            We do not knowingly collect personal information from children. The app does not sell
            alcoholic beverages; please drink responsibly.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Contact</h2>
          <p>
            Questions or privacy requests can be sent to{" "}
            <a className="text-[#d4af57] underline" href="mailto:contact@split-the-g.app">
              contact@split-the-g.app
            </a>
            .
          </p>
        </section>

        <p className="border-t border-[#d4af57]/20 pt-6 text-sm text-[#b8aa94]">
          This policy may be updated as the service changes. The date above shows the latest
          revision.
        </p>
      </article>
    </main>
  );
}
