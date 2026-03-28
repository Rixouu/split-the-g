import { redirect, type LoaderFunctionArgs } from "react-router";
import { isCompetitionUuidParam } from "~/utils/competitionPath";
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
  if (!row) throw new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const expectedTail = row.path_segment?.trim() || row.id;
  const currentTail = decodeURIComponent(
    url.pathname.replace(/^\/competitions\//i, "").replace(/\/+$/, ""),
  );
  if (currentTail !== expectedTail) {
    throw redirect(
      `/competitions/${encodeURIComponent(expectedTail)}${url.search}`,
    );
  }

  return {
    competitionId: row.id,
    competition: row,
    loadError: null as string | null,
  };
}
