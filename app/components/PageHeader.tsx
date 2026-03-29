import type { ReactNode } from "react";
import { useMemo } from "react";
import { AppLink } from "~/i18n/app-link";
import { useOptionalLang } from "~/i18n/context";
import { createTranslator } from "~/i18n/load-messages";

export * from "./page-descriptions";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, links) */
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  /**
   * Title on top, actions full width below (buttons can share a row on sm+).
   * Use for primary CTAs that should span the content column.
   */
  variant?: "default" | "stacked";
}

/**
 * Shared page title row: title + description left; actions right on sm+.
 * On small screens, actions stack below and span full width for tap targets.
 */
export function PageHeader({
  title,
  description,
  children,
  className = "",
  titleClassName = "",
  descriptionClassName = "",
  variant = "default",
}: PageHeaderProps) {
  const stacked = variant === "stacked";
  return (
    <header
      className={`mb-6 flex flex-col gap-4 ${
        stacked
          ? "sm:gap-5"
          : "sm:flex-row sm:items-end sm:justify-between sm:gap-3"
      } ${className}`}
    >
      <div className={`min-w-0 ${stacked ? "w-full" : "flex-1"}`}>
        <h1
          className={`type-display text-3xl text-guinness-gold sm:text-4xl ${titleClassName}`}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={`type-meta mt-1 max-w-2xl text-guinness-tan/80 ${descriptionClassName}`}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div
        className={
          stacked
            ? "flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:gap-3 [&_a]:w-full [&_button]:w-full sm:[&_a]:flex-1 sm:[&_button]:flex-1"
            : "flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 [&_a]:w-full [&_button]:w-full sm:[&_a]:w-auto sm:[&_button]:w-auto"
        }
      >
        {children}
      </div>
    </header>
  );
}

/** Outer shell for main app pages aligned with Feed */
export const pageShellClass =
  "mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8";

/**
 * Primary header action (matches leaderboard “View Submissions”): solid gold, consistent min height.
 */
export const pageHeaderActionButtonClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-guinness-gold px-4 py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan sm:px-6 sm:text-base";

/**
 * Footer / end-of-page CTA to home for a new split — ghost outline. Uses {@link EndPageNewPourFooter} label.
 * Profile hub and similar use this full-width beside “Split the G” / new score flows.
 */
export const homePourButtonClass =
  "inline-flex min-h-11 w-full max-w-none items-center justify-center rounded-lg border-2 border-guinness-gold/45 bg-transparent px-6 py-3 text-sm font-semibold text-guinness-gold transition-colors hover:border-guinness-gold hover:bg-guinness-gold/[0.08]";

/** End-of-page CTA — same block as `/wall` (ghost “New Split” → home). */
export function EndPageNewPourFooter() {
  const lang = useOptionalLang();
  const t = useMemo(() => createTranslator(lang), [lang]);
  return (
    <div className="mt-10 flex justify-center pb-6">
      <AppLink to="/" viewTransition className={homePourButtonClass}>
        {t("common.newPour")}
      </AppLink>
    </div>
  );
}
