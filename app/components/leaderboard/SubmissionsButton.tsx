import { Link } from "react-router";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";

interface SubmissionsButtonProps {
  className?: string;
}

export function SubmissionsButton({ className = "" }: SubmissionsButtonProps) {
  return (
    <Link
      to="/wall"
      prefetch="intent"
      viewTransition
      className={`${pageHeaderActionButtonClass} ${className}`.trim()}
    >
      View Submissions
    </Link>
  );
}
