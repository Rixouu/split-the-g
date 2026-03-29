import { useEffect, useState } from "react";
import { AppLink } from "~/i18n/app-link";
import { CompetitionCreateForm } from "~/components/competition/CompetitionCreateForm";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/competitions/new", "competitions");
}

export default function CompetitionNewRoute() {
  const { t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={t("pages.competitions.newCompetition")}
          description={t("pages.competitions.newPageDescription")}
        >
          <AppLink
            to="/competitions"
            viewTransition
            className={pageHeaderActionButtonClass}
          >
            {t("pages.competitions.newPageBack")}
          </AppLink>
        </PageHeader>

        {userId ? (
          <CompetitionCreateForm />
        ) : (
          <div className="max-w-2xl space-y-4">
            <p className="type-meta text-guinness-tan/75">
              {t("pages.competitions.newPageSignIn")}
            </p>
            <AppLink
              to="/profile"
              viewTransition
              className="inline-flex rounded-lg bg-guinness-gold px-4 py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan"
            >
              {t("pages.competitions.profileFriends")}
            </AppLink>
          </div>
        )}
      </div>
    </main>
  );
}
