import { AppLink } from "~/i18n/app-link";
import { scorePourPathFromFields } from "~/utils/scorePath";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { useProfileOutlet } from "./profile-context";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/scores", "scores");
}

export default function ProfileScoresPage() {
  const { t } = useI18n();
  const { scores } = useProfileOutlet();

  return scores.length > 0 ? (
    <section>
      <h2 className="type-card-title mb-3">
        {t("pages.profile.scoresRecentTitle")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {scores.map((s) => (
          <li key={s.id}>
            <AppLink
              to={scorePourPathFromFields(s)}
              prefetch="intent"
              viewTransition
              className="block rounded-xl border border-guinness-gold/15 bg-guinness-brown/30 p-4 transition-colors hover:border-guinness-gold/35"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tabular-nums text-guinness-gold">
                  {s.split_score.toFixed(2)}
                </span>
                <span className="type-meta text-guinness-tan/65">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
              {s.bar_name ? (
                <p className="type-meta mt-2 text-guinness-tan/55">{s.bar_name}</p>
              ) : null}
              {s.pint_price != null && Number.isFinite(Number(s.pint_price)) ? (
                <p className="type-meta mt-1 text-guinness-tan/45">
                  {t("pages.profile.scoresPaid", {
                    amount: Number(s.pint_price).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }),
                  })}
                </p>
              ) : null}
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  ) : (
    <p className="type-meta text-guinness-tan/70">
      {t("pages.profile.scoresEmptyBlurb")}
    </p>
  );
}
