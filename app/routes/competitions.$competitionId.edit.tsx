import { useLoaderData, useParams } from "react-router";
import { useEffect, useState } from "react";
import { AppLink } from "~/i18n/app-link";
import { CompetitionEditForm } from "~/components/competition/CompetitionEditForm";
import { useCompetitionRouteResolution } from "~/components/competition/hooks/useCompetitionRouteResolution";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import type { loader as competitionDetailLoader } from "./competitions.$competitionId.loader";
import { competitionDetailPath } from "~/utils/competitionPath";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";

export { loader } from "./competitions.$competitionId.loader";

export function meta({
  params,
}: {
  params: { competitionId?: string; lang?: string };
}) {
  const competitionId = params.competitionId?.trim();
  return seoMetaForRoute(
    params,
    competitionId
      ? `/competitions/${encodeURIComponent(competitionId)}/edit`
      : "/competitions",
    "competitions",
  );
}

export default function CompetitionEditRoute() {
  const { t } = useI18n();
  const params = useParams();
  const { competition: loaderComp, loadError } =
    useLoaderData<typeof competitionDetailLoader>();
  const {
    competition,
    pending: clientResolvePending,
    notFound: clientNotFound,
    resolveError,
  } = useCompetitionRouteResolution(loaderComp, params.competitionId);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  const combinedLoadError = loadError ?? resolveError;

  if (!params.competitionId?.trim()) {
    return null;
  }

  if (combinedLoadError && !competition && !clientResolvePending) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-red-400/90">{combinedLoadError}</p>
          <AppLink
            to="/competitions"
            viewTransition
            className="mt-4 inline-block text-guinness-gold underline"
          >
            {t("pages.competitionDetail.backToListError")}
          </AppLink>
        </div>
      </main>
    );
  }

  if (clientNotFound && !clientResolvePending) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-guinness-tan/80">
            {t("pages.competitionDetail.competitionNotFound")}
          </p>
          <AppLink
            to="/competitions"
            viewTransition
            className="mt-4 inline-block text-guinness-gold underline"
          >
            {t("pages.competitionDetail.backToListError")}
          </AppLink>
        </div>
      </main>
    );
  }

  if (!competition) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <p className="type-meta text-guinness-tan/70">
            {t("pages.competitionDetail.loadingCompetition")}
          </p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <PageHeader
            title={t("pages.competitions.editSectionTitle")}
            description={t("pages.competitions.editPageDescription")}
          >
            <AppLink
              to={competitionDetailPath(competition)}
              viewTransition
              className={pageHeaderActionButtonClass}
            >
              {t("pages.competitions.editPageBack")}
            </AppLink>
          </PageHeader>
          <p className="type-meta text-guinness-tan/75">
            {t("pages.competitions.editSignIn")}
          </p>
          <AppLink
            to="/profile"
            viewTransition
            className="mt-4 inline-block text-guinness-gold underline"
          >
            {t("pages.competitions.profileFriends")}
          </AppLink>
        </div>
      </main>
    );
  }

  if (userId !== competition.created_by) {
    return (
      <main className="min-h-screen bg-guinness-black text-guinness-cream">
        <div className={pageShellClass}>
          <PageHeader
            title={t("pages.competitions.editSectionTitle")}
            description={t("pages.competitions.editPageDescription")}
          >
            <AppLink
              to={competitionDetailPath(competition)}
              viewTransition
              className={pageHeaderActionButtonClass}
            >
              {t("pages.competitions.editPageBack")}
            </AppLink>
          </PageHeader>
          <p className="type-meta text-guinness-tan/80">
            {t("pages.competitions.editForbidden")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={t("pages.competitions.editSectionTitle")}
          description={t("pages.competitions.editPageDescription")}
        >
          <AppLink
            to={competitionDetailPath(competition)}
            viewTransition
            className={pageHeaderActionButtonClass}
          >
            {t("pages.competitions.editPageBack")}
          </AppLink>
        </PageHeader>
        <CompetitionEditForm competition={competition} />
      </div>
    </main>
  );
}
