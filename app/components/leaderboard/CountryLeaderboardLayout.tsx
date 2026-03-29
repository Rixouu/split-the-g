import { AppLink } from "~/i18n/app-link";
import { LeaderboardNavigation } from "~/components/leaderboard/LeaderboardNavigation";
import { CountryStatsTable } from "~/components/leaderboard/CountryStatsTable";
import { homePourButtonClass } from "~/components/PageHeader";
import { useI18n } from "~/i18n/context";

interface CountryStats {
  country: string;
  country_code: string;
  submission_count: number;
  average_score: number;
}

interface CountryLeaderboardLayoutProps {
  activePage: "past24hr" | "alltime";
  submissions: CountryStats[];
}

export function CountryLeaderboardLayout({
  activePage,
  submissions,
}: CountryLeaderboardLayoutProps) {
  const { t } = useI18n();
  const tableTitle =
    activePage === "past24hr"
      ? t("pages.leaderboard.countryTableTitle24h")
      : t("pages.leaderboard.countryTableTitleAllTime");
  return (
    <main className="min-h-screen bg-guinness-black py-4 md:py-8">
      <div className="container mx-auto px-2 md:px-4">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="type-display text-2xl md:text-4xl mb-4 px-2">
            {t("pages.leaderboard.worldsLargest")}
          </h1>
          <AppLink to="/" viewTransition className={`${homePourButtonClass} mx-auto`}>
            {t("pages.leaderboard.newPour")}
          </AppLink>
        </div>
        <div className="flex justify-center gap-4 mb-4 md:mb-8">
          <LeaderboardNavigation activePage={activePage} />
        </div>

        <CountryStatsTable title={tableTitle} submissions={submissions} />

        <div className="mt-10 flex justify-center pb-6 md:mt-10">
          <AppLink to="/" viewTransition className={homePourButtonClass}>
            {t("pages.leaderboard.newPour")}
          </AppLink>
        </div>
      </div>
    </main>
  );
}
