import { Link } from "react-router";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";

interface LeaderboardButtonProps {
  className?: string;
}

export function LeaderboardButton({ className = "" }: LeaderboardButtonProps) {
  return (
    <Link
      to="/leaderboard"
      className={`${pageHeaderActionButtonClass} ${className}`}
    >
      View Top Splits
    </Link>
  );
}
