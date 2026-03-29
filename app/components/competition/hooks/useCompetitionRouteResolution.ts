import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useI18n } from "~/i18n/context";
import { localizePath, stripLocalePrefix } from "~/i18n/paths";
import type { CompetitionRow } from "~/routes/competitions.shared";
import { fetchCompetitionRowByRouteParam } from "~/utils/fetch-competition-client";
import {
  competitionPathHasEditSuffix,
  competitionRouteParamFromPathname,
} from "~/utils/competitionPath";

/**
 * SSR loader uses anon Supabase (no session), so private rows are omitted.
 * This hook loads the competition in the browser with the user session and
 * applies the same canonical path redirect as the server loader.
 */
export function useCompetitionRouteResolution(
  loaderCompetition: CompetitionRow | null,
  routeParam: string | undefined,
) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<CompetitionRow | null>(
    loaderCompetition,
  );
  const [pending, setPending] = useState(() => !loaderCompetition);
  const [notFound, setNotFound] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (loaderCompetition) {
      setCompetition(loaderCompetition);
      setNotFound(false);
      setPending(false);
      setResolveError(null);
    }
  }, [loaderCompetition]);

  useEffect(() => {
    if (loaderCompetition) return;

    const raw = routeParam?.trim() ?? "";
    if (!raw) {
      setCompetition(null);
      setPending(false);
      setNotFound(true);
      setResolveError(null);
      return;
    }

    let cancelled = false;
    setCompetition(null);
    setPending(true);
    setNotFound(false);
    setResolveError(null);

    void (async () => {
      const { row, error } = await fetchCompetitionRowByRouteParam(raw);
      if (cancelled) return;
      if (error) {
        setPending(false);
        setResolveError(error);
        return;
      }
      if (!row) {
        setPending(false);
        setNotFound(true);
        return;
      }
      const expectedTail = row.path_segment?.trim() || row.id;
      const pathSansLang = stripLocalePrefix(window.location.pathname);
      const currentTail = competitionRouteParamFromPathname(pathSansLang);
      const suffix = competitionPathHasEditSuffix(pathSansLang) ? "/edit" : "";
      if (currentTail !== expectedTail) {
        navigate(
          `${localizePath(`/competitions/${encodeURIComponent(expectedTail)}${suffix}`, lang)}${window.location.search}`,
          { replace: true },
        );
        return;
      }
      setCompetition(row);
      setPending(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loaderCompetition, routeParam, lang, navigate]);

  return {
    competition,
    setCompetition,
    pending,
    notFound,
    resolveError,
    effectiveId: competition?.id ?? "",
  };
}
