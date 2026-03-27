import { type LoaderFunction } from "react-router";
import { useLoaderData } from "react-router";
import { supabase } from "~/utils/supabase";
import { CountryLeaderboardLayout } from "~/components/leaderboard/CountryLeaderboardLayout";

type CountryStats = {
  country: string;
  country_code: string;
  submission_count: number;
  average_score: number;
};

export const loader: LoaderFunction = async () => {
  // Use the database function to get aggregated country stats
  const { data, error } = await supabase.rpc("get_country_stats_24h");

  if (error) throw error;

  return { submissions: data || [] };
};

export default function Collage() {
  const { submissions } = useLoaderData<{ submissions: CountryStats[] }>();

  return (
    <CountryLeaderboardLayout
      activePage="past24hr"
      tableTitle="Past 24 Hour Splits By Country"
      submissions={submissions}
    />
  );
}
