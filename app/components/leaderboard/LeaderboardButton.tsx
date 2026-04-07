import { AppDocumentLink } from "~/i18n/app-link";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";
import { useI18n } from "~/i18n/context";

interface LeaderboardButtonProps {
  className?: string;
}

export function LeaderboardButton({ className = "" }: LeaderboardButtonProps) {
  const { t } = useI18n();
  return (
    <AppDocumentLink
      to="/leaderboard"
      prefetch="intent"
      viewTransition
      className={`${pageHeaderActionButtonClass} ${className}`}
    >
      {t("pages.leaderboard.viewTopSplits")}
    </AppDocumentLink>
  );
}
