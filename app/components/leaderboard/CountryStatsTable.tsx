import { getCountryFlag } from "~/utils/leaderboard";

interface CountryStats {
  country: string;
  country_code: string;
  submission_count: number;
  average_score: number;
}

interface CountryStatsTableProps {
  title: string;
  submissions: CountryStats[];
}

export function CountryStatsTable({ title, submissions }: CountryStatsTableProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <p className="type-section mb-4 px-2 md:px-4">
        {title}
      </p>
      <div className="bg-guinness-gold/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-1 md:gap-4 p-2 md:p-4 text-guinness-gold font-bold border-b border-guinness-gold/20 text-xs md:text-base">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Country</div>
          <div className="col-span-3 text-right">Splits</div>
          <div className="col-span-3 text-right">Avg</div>
        </div>
        {submissions.map((stat, index) => (
          <div
            key={stat.country}
            className="grid grid-cols-12 gap-1 md:gap-4 p-2 md:p-4 text-guinness-cream/90 hover:bg-guinness-gold/5 transition-colors border-b border-guinness-gold/10 last:border-0 text-xs md:text-base"
          >
            <div className="col-span-1 text-guinness-gold">#{index + 1}</div>
            <div className="col-span-5 flex items-center gap-1 md:gap-2">
              <span className="text-sm md:text-xl flex-shrink-0">
                {getCountryFlag(stat.country_code)}
              </span>
              <span className="text-[0.65rem] md:text-base leading-tight">
                {stat.country}
              </span>
            </div>
            <div className="col-span-3 text-right">{stat.submission_count}</div>
            <div className="col-span-3 text-right">
              {stat.average_score.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
