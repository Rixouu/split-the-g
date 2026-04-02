import { Megaphone } from "lucide-react";
import { pageHeaderActionButtonClass } from "~/components/PageHeader";

export interface AdSlotBannerProps {
  /** Extra classes on the outer aside (e.g. `mb-6`). */
  className?: string;
  ariaLabel: string;
  /** Small uppercase line — reads like an IAB-style slot label. */
  slotLabel: string;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}

/**
 * Horizontal promo strip styled as a display-ad slot (not a generic content card):
 * dashed frame, diagonal sheen, top beacon, megaphone glyph, solid gold CTA.
 */
export function AdSlotBanner({
  className = "",
  ariaLabel,
  slotLabel,
  title,
  body,
  ctaHref,
  ctaLabel,
}: AdSlotBannerProps) {
  return (
    <aside
      className={`relative overflow-hidden rounded-xl border border-dashed border-guinness-gold/45 bg-gradient-to-r from-black via-[#070605] to-guinness-brown/20 shadow-[inset_0_1px_0_rgba(212,175,55,0.14),inset_0_0_0_1px_rgba(0,0,0,0.35)] ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          backgroundImage:
            "repeating-linear-gradient(-52deg, transparent, transparent 6px, rgba(212,175,55,0.06) 6px, rgba(212,175,55,0.06) 7px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-3 top-0 z-[1] h-[3px] rounded-b-sm bg-gradient-to-r from-guinness-gold/25 via-guinness-gold/75 to-guinness-gold/25 sm:inset-x-5"
        aria-hidden
      />

      <div className="relative z-[2] flex flex-col gap-3 px-3 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4">
        <div className="flex min-w-0 flex-1 gap-3 sm:items-center">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-guinness-gold/35 bg-guinness-gold/[0.07] text-guinness-gold shadow-[inset_0_1px_0_rgba(212,175,55,0.2)]"
            aria-hidden
          >
            <Megaphone className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-guinness-gold/45">
              {slotLabel}
            </p>
            <p className="mt-0.5 text-base font-semibold leading-snug text-guinness-gold sm:text-lg">
              {title}
            </p>
            <p className="type-meta mt-1 text-guinness-tan/55 sm:text-guinness-tan/60">
              {body}
            </p>
          </div>
        </div>
        <a
          href={ctaHref}
          className={`${pageHeaderActionButtonClass} w-full text-center no-underline sm:w-auto sm:shrink-0`}
        >
          {ctaLabel}
        </a>
      </div>
    </aside>
  );
}
