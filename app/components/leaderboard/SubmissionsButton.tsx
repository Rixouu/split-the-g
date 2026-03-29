import { AppLink } from "~/i18n/app-link";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";
import { useI18n } from "~/i18n/context";

interface SubmissionsButtonProps {
  className?: string;
}

export function SubmissionsButton({ className = "" }: SubmissionsButtonProps) {
  const { t } = useI18n();
  return (
    <AppLink
      to="/wall"
      prefetch="intent"
      viewTransition
      className={`${pageHeaderActionButtonClass} ${className}`.trim()}
    >
      {t("pages.leaderboard.viewSubmissions")}
    </AppLink>
  );
}
