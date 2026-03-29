import { Link } from "react-router";
import type { ReactNode } from "react";

/** Dark brown stroke — matches pub list / venue cards (no light borders). */
export const PUB_VENUE_CARD_STROKE = "border-[#322914]";

function IconPubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" />
      <path d="M12 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  );
}

function IconPour({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2h8l-1 14a4 4 0 0 1-6 0L8 2Z" />
      <path d="M10 22h4" />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function StatPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border ${PUB_VENUE_CARD_STROKE} bg-guinness-black/45 px-2.5 py-1 text-xs font-medium text-guinness-tan/90 tabular-nums`}
    >
      <span className="text-guinness-gold/80 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      {children}
    </span>
  );
}

const mainTapClassName =
  "flex min-w-0 flex-1 gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-guinness-gold/45 sm:gap-4 sm:p-5";

export interface PubVenueCardProps {
  title: string;
  address?: string | null;
  /** When set, icon + text block links here (e.g. pub wall). */
  primaryTo?: string;
  submissionCount: number;
  avgPourRating?: number | null;
  ratingCount: number;
  /** View / Favorite / Maps / Remove — same shell as pubs list */
  actions: ReactNode;
  className?: string;
}

/**
 * Shared venue card chrome for `/pubs` and profile favorites (and similar).
 * Action buttons differ per screen; layout stays aligned.
 */
export function PubVenueCard({
  title,
  address,
  primaryTo,
  submissionCount,
  avgPourRating,
  ratingCount,
  actions,
  className = "",
}: PubVenueCardProps) {
  const pourLabel =
    submissionCount === 1 ? "1 pour" : `${submissionCount} pours`;
  const hasRating =
    ratingCount > 0 && avgPourRating != null && Number.isFinite(avgPourRating);

  const body = (
    <>
      <div className="relative flex shrink-0 flex-col items-center">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${PUB_VENUE_CARD_STROKE} bg-guinness-gold/[0.08] text-guinness-gold sm:h-16 sm:w-16`}
        >
          <IconPubMark className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
      </div>

      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold leading-snug text-guinness-gold transition-colors group-hover:text-guinness-tan sm:text-xl">
            {title}
          </h2>
          {primaryTo ? (
            <IconChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-guinness-gold/45 transition-transform group-hover:translate-x-0.5 group-hover:text-guinness-gold/70 sm:hidden" />
          ) : null}
        </div>
        {address ? (
          <p className="type-meta mt-1 line-clamp-2 text-guinness-tan/65">
            {address}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatPill icon={<IconPour />}>{pourLabel}</StatPill>
          {hasRating ? (
            <StatPill icon={<IconStar />}>
              <span className="text-guinness-gold">
                {avgPourRating!.toFixed(1)}
              </span>
              <span className="text-guinness-tan/55">/ 5</span>
              <span className="text-guinness-tan/45">
                · {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
              </span>
            </StatPill>
          ) : (
            <span
              className={`inline-flex items-center rounded-lg border border-dashed ${PUB_VENUE_CARD_STROKE} bg-guinness-black/25 px-2.5 py-1 text-xs text-guinness-tan/50`}
            >
              No ratings yet
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <li
      className={`group relative overflow-hidden rounded-2xl border ${PUB_VENUE_CARD_STROKE} bg-gradient-to-br from-guinness-brown/50 via-guinness-brown/35 to-guinness-black/40 shadow-[inset_0_1px_0_rgba(212,175,55,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-guinness-gold/25 hover:shadow-[inset_0_1px_0_rgba(212,175,55,0.07)] ${className}`.trim()}
    >
      <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-guinness-gold/[0.06] blur-2xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-stretch">
        {primaryTo ? (
          <Link
            to={primaryTo}
            viewTransition
            prefetch="intent"
            className={mainTapClassName}
          >
            {body}
          </Link>
        ) : (
          <div className={`${mainTapClassName} cursor-default`}>{body}</div>
        )}

        <div
          className={`flex shrink-0 flex-row gap-2 border-t ${PUB_VENUE_CARD_STROKE} p-4 pt-3 sm:w-auto sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:py-5 sm:pl-4 sm:pr-5`}
        >
          {actions}
        </div>
      </div>
    </li>
  );
}

/** Shared action button styles for slots next to `PubVenueCard`. */
export const pubVenueCardActionOutlineClass = `inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border ${PUB_VENUE_CARD_STROKE} bg-guinness-black/50 px-3 text-xs font-semibold text-guinness-gold transition-colors hover:border-guinness-gold/35 hover:bg-guinness-gold/10 sm:flex-none sm:min-w-[5.75rem]`;

export const pubVenueCardActionMutedClass = `inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors disabled:opacity-50 sm:flex-none sm:min-w-[5.75rem] ${PUB_VENUE_CARD_STROKE} bg-guinness-black/35 text-guinness-tan hover:border-guinness-gold/30 hover:text-guinness-cream`;

export const pubVenueCardActionSavedClass =
  "inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-guinness-gold/40 bg-guinness-gold/12 px-3 text-xs font-semibold text-guinness-gold transition-colors disabled:opacity-50 sm:flex-none sm:min-w-[5.75rem]";

export const pubVenueCardActionDangerClass =
  "inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-red-400/45 bg-guinness-black/35 px-3 text-xs font-semibold text-red-400/95 transition-colors hover:bg-red-950/25 disabled:opacity-50 sm:flex-none sm:min-w-[5.75rem]";
