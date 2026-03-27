import { Link } from "react-router";
import { LeaderboardNavigation } from "~/components/leaderboard/LeaderboardNavigation";
import { CountryStatsTable } from "~/components/leaderboard/CountryStatsTable";

interface CountryStats {
  country: string;
  country_code: string;
  submission_count: number;
  average_score: number;
}

interface CountryLeaderboardLayoutProps {
  activePage: "past24hr" | "alltime";
  tableTitle: string;
  submissions: CountryStats[];
}

export function CountryLeaderboardLayout({
  activePage,
  tableTitle,
  submissions,
}: CountryLeaderboardLayoutProps) {
  return (
    <main className="min-h-screen bg-guinness-black py-4 md:py-8">
      <div className="container mx-auto px-2 md:px-4">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="type-display text-2xl md:text-4xl mb-4 px-2">
            The world&apos;s largest Split the G contest
          </h1>
          <Link
            to="/"
            className="text-guinness-gold hover:text-guinness-tan transition-colors inline-block"
          >
            ← Back to Split
          </Link>
        </div>
        <div className="flex justify-center gap-4 mb-4 md:mb-8">
          <LeaderboardNavigation activePage={activePage} />
        </div>

        <CountryStatsTable title={tableTitle} submissions={submissions} />

        <div className="mt-4 md:mt-8 text-center">
          <Link
            to="/"
            className="inline-block px-4 md:px-6 py-2 md:py-3 bg-guinness-gold/10 hover:bg-guinness-gold/20 text-guinness-gold border border-guinness-gold/20 rounded-lg transition-colors text-sm md:text-base"
          >
            Back to Split
          </Link>
        </div>
      </div>
    </main>
  );
}
