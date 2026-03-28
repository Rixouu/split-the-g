import type { LoaderFunctionArgs } from "react-router";
import { supabase } from "~/utils/supabase";
import { COMPETITION_ROW_SELECT, type CompetitionRow } from "./competitions.shared";

export async function loader(_args: LoaderFunctionArgs) {
  const { data, error } = await supabase
    .from("competitions")
    .select(COMPETITION_ROW_SELECT)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return {
      competitions: [] as CompetitionRow[],
      listError: error.message,
      participantCounts: {} as Record<string, number>,
    };
  }

  const competitions = (data ?? []) as CompetitionRow[];
  const ids = competitions.map((c) => c.id);
  const participantCounts: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: parts } = await supabase
      .from("competition_participants")
      .select("competition_id")
      .in("competition_id", ids);

    for (const row of parts ?? []) {
      const id = row.competition_id as string;
      participantCounts[id] = (participantCounts[id] ?? 0) + 1;
    }
  }

  return {
    competitions,
    listError: null as string | null,
    participantCounts,
  };
}
