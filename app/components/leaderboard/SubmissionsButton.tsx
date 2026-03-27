import { Link } from "react-router";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";

interface SubmissionsButtonProps {
  className?: string;
}

export function SubmissionsButton({ className = "" }: SubmissionsButtonProps) {
  return (
    <Link
      to="/wall"
      className={`${pageHeaderActionButtonClass} ${className}`.trim()}
    >
      View Submissions
    </Link>
  );
}
