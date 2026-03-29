import { AppLink } from "~/i18n/app-link";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";

interface LeaderboardButtonProps {
  className?: string;
}

export function LeaderboardButton({ className = "" }: LeaderboardButtonProps) {
  return (
    <AppLink
      to="/leaderboard"
      prefetch="intent"
      viewTransition
      className={`${pageHeaderActionButtonClass} ${className}`}
    >
      View Top Splits
    </AppLink>
  );
}
