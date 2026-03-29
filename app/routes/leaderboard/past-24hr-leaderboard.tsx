import { type LoaderFunction } from "react-router";
import { useLoaderData } from "react-router";
import { supabase } from "~/utils/supabase";
import { CountryLeaderboardLayout } from "~/components/leaderboard/CountryLeaderboardLayout";
import { seoMetaForRoute } from "~/i18n/seo-meta";

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

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/past24hrleaderboard", "past24hr");
}

export default function Collage() {
  const { submissions } = useLoaderData<{ submissions: CountryStats[] }>();

  return (
    <CountryLeaderboardLayout
      activePage="past24hr"
      submissions={submissions}
    />
  );
}
