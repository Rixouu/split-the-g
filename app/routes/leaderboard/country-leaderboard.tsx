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
  const { data, error } = await supabase.rpc("get_country_stats_all_time");

  if (error) throw error;

  return { submissions: data || [] };
};

export default function Collage() {
  const { submissions } = useLoaderData<{ submissions: CountryStats[] }>();

  return (
    <CountryLeaderboardLayout
      activePage="alltime"
      tableTitle="All Time Splits By Country"
      submissions={submissions}
    />
  );
}
