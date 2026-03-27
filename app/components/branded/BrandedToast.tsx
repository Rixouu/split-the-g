import { useEffect } from "react";
import type { BrandedNoticeVariant } from "./BrandedNotice";

const variantBorder: Record<BrandedNoticeVariant, string> = {
  info: "border-guinness-gold/40 shadow-[0_0_24px_rgba(179,139,45,0.12)]",
  success: "border-emerald-500/35 shadow-[0_0_24px_rgba(52,211,153,0.1)]",
  warning: "border-amber-500/35 shadow-[0_0_24px_rgba(251,191,36,0.1)]",
  danger: "border-red-500/35 shadow-[0_0_24px_rgba(248,113,113,0.1)]",
};

const variantDot: Record<BrandedNoticeVariant, string> = {
  info: "bg-guinness-gold",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
};

export interface BrandedToastProps {
  open: boolean;
  message: string;
  variant?: BrandedNoticeVariant;
  title?: string;
  onClose: () => void;
  /** Auto-dismiss; omit to require manual close only. */
  autoCloseMs?: number;
}

export function BrandedToast({
  open,
  message,
  variant = "info",
  title,
  onClose,
  autoCloseMs,
}: BrandedToastProps) {
  useEffect(() => {
    if (!open || autoCloseMs == null) return;
    const t = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open || !message) return null;

  const border = variantBorder[variant];
  const dot = variantDot[variant];

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-4 right-4 z-[190] flex justify-center md:left-auto md:right-6 md:justify-end"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex max-w-md animate-branded-toast-in gap-3 rounded-xl border bg-gradient-to-br from-guinness-brown/98 to-guinness-black/95 px-4 py-3.5 backdrop-blur-md sm:px-5 ${border}`}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className="text-sm font-semibold text-guinness-gold">{title}</p>
          ) : null}
          <p
            className={`text-sm leading-snug ${title ? "mt-1 text-guinness-tan/85" : "text-guinness-cream"}`}
          >
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-guinness-tan/60 transition-colors hover:bg-guinness-gold/10 hover:text-guinness-gold"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
