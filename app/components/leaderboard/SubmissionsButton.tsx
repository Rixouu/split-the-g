import { AppLink } from "~/i18n/app-link";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";

interface SubmissionsButtonProps {
  className?: string;
}

export function SubmissionsButton({ className = "" }: SubmissionsButtonProps) {
  return (
    <AppLink
      to="/wall"
      prefetch="intent"
      viewTransition
      className={`${pageHeaderActionButtonClass} ${className}`.trim()}
    >
      View Submissions
    </AppLink>
  );
}
