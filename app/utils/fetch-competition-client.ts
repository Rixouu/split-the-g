import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { isCompetitionUuidParam } from "~/utils/competitionPath";
import {
  COMPETITION_ROW_SELECT,
  type CompetitionRow,
} from "~/routes/competitions.shared";

export async function fetchCompetitionRowByRouteParam(
  raw: string,
): Promise<{ row: CompetitionRow | null; error: string | null }> {
  const trimmed = raw.trim();
  if (!trimmed) return { row: null, error: null };

  const supabase = await getSupabaseBrowserClient();
  const query = isCompetitionUuidParam(trimmed)
    ? supabase
        .from("competitions")
        .select(COMPETITION_ROW_SELECT)
        .eq("id", trimmed)
        .maybeSingle()
    : supabase
        .from("competitions")
        .select(COMPETITION_ROW_SELECT)
        .ilike("path_segment", trimmed)
        .maybeSingle();

  const { data, error } = await query;
  if (error) return { row: null, error: error.message };
  return { row: (data ?? null) as CompetitionRow | null, error: null };
}
