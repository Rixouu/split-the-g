import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Support | Split The G" },
  { name: "description", content: "Help and contact information for Split The G." },
];

export default function Support() {
  return (
    <main className="min-h-dvh bg-[#050608] px-5 py-12 text-[#f4efe6]">
      <article className="mx-auto max-w-2xl space-y-7 rounded-3xl border border-[#d4af57]/25 bg-[#0d0d0e] p-6 shadow-2xl sm:p-10">
        <header className="space-y-3 border-b border-[#d4af57]/20 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d4af57]">
            Split The G
          </p>
          <h1 className="text-4xl font-bold">Support</h1>
          <p className="text-[#b8aa94]">Help with pour analysis, accounts, and app features.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#d4af57]">Pour analysis tips</h2>
          <p>
            Place the whole pint inside the camera guide, keep the Guinness G visible, use even
            lighting, and hold the phone steady. You can also choose an existing photo from your
            library.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#d4af57]">Accounts and deletion</h2>
          <p>
            Sign in with Apple or Google to save progress and social activity. To permanently
            delete your account and associated data, open Profile → Account → Delete account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#d4af57]">Contact us</h2>
          <p>
            Email{" "}
            <a className="text-[#d4af57] underline" href="mailto:contact@split-the-g.app">
              contact@split-the-g.app
            </a>
            . Please include your device model, iOS version, and a short description of the issue.
          </p>
          <p>
            Read our{" "}
            <a className="text-[#d4af57] underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
