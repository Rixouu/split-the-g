import { redirect, type LoaderFunctionArgs } from "react-router";
import { langFromParams } from "~/i18n/lang-param";
import { localizePath, stripLocalePrefix } from "~/i18n/paths";
import {
  competitionPathHasEditSuffix,
  competitionRouteParamFromPathname,
  isCompetitionUuidParam,
} from "~/utils/competitionPath";
import { supabase } from "~/utils/supabase";
import {
  COMPETITION_ROW_SELECT,
  type CompetitionRow,
} from "./competitions.shared";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const raw = (params.competitionId ?? "").trim();
  if (!raw) throw new Response("Not found", { status: 404 });

  const query = isCompetitionUuidParam(raw)
    ? supabase.from("competitions").select(COMPETITION_ROW_SELECT).eq("id", raw)
    : supabase
        .from("competitions")
        .select(COMPETITION_ROW_SELECT)
        .ilike("path_segment", raw);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      competitionId: "",
      competition: null as CompetitionRow | null,
      loadError: error.message,
    };
  }

  const row = (data ?? null) as CompetitionRow | null;
  // Anon server client cannot see private rows (RLS). Client resolves with session.
  if (!row) {
    return {
      competitionId: "",
      competition: null as CompetitionRow | null,
      loadError: null as string | null,
    };
  }

  const url = new URL(request.url);
  const expectedTail = row.path_segment?.trim() || row.id;
  const pathSansLang = stripLocalePrefix(url.pathname);
  const currentTail = competitionRouteParamFromPathname(pathSansLang);
  if (currentTail !== expectedTail) {
    const lang = langFromParams(params);
    const editSuffix = competitionPathHasEditSuffix(pathSansLang) ? "/edit" : "";
    throw redirect(
      `${localizePath(`/competitions/${encodeURIComponent(expectedTail)}${editSuffix}`, lang)}${url.search}`,
    );
  }

  return {
    competitionId: row.id,
    competition: row,
    loadError: null as string | null,
  };
}
