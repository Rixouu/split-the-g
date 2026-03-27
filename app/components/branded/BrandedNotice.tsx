import { useEffect, useRef } from "react";

export type BrandedNoticeVariant = "info" | "success" | "warning" | "danger";

const variantAccent: Record<BrandedNoticeVariant, string> = {
  info: "from-guinness-gold/90 to-guinness-gold/40",
  success: "from-emerald-400/90 to-emerald-600/40",
  warning: "from-amber-400/90 to-amber-600/35",
  danger: "from-red-500/90 to-red-700/40",
};

export interface BrandedNoticeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: BrandedNoticeVariant;
  primaryLabel?: string;
  onPrimary?: () => void | Promise<void>;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function BrandedNotice({
  open,
  onOpenChange,
  title,
  description,
  variant = "info",
  primaryLabel = "OK",
  onPrimary,
  secondaryLabel,
  onSecondary,
}: BrandedNoticeProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const accent = variantAccent[variant];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-guinness-black/80 backdrop-blur-sm transition-opacity duration-200 animate-branded-backdrop-in"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="branded-notice-title"
        className="relative z-10 w-full max-w-md animate-branded-panel-in rounded-2xl border border-guinness-gold/30 bg-gradient-to-b from-guinness-brown via-guinness-brown/95 to-guinness-black shadow-[0_24px_64px_rgba(0,0,0,0.65),0_0_0_1px_rgba(197,160,89,0.12)]"
      >
        <div
          className={`h-1 w-full rounded-t-2xl bg-gradient-to-r ${accent}`}
          aria-hidden
        />
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <h2
            id="branded-notice-title"
            className="type-card-title text-lg text-guinness-gold sm:text-xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="type-body-muted mt-3 text-[0.9375rem] leading-relaxed">
              {description}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            {secondaryLabel ? (
              <button
                type="button"
                onClick={() => {
                  onSecondary?.();
                  onOpenChange(false);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-guinness-gold/35 bg-guinness-black/40 px-4 py-2.5 text-sm font-semibold text-guinness-tan transition-colors hover:border-guinness-gold/55 hover:bg-guinness-brown/60 hover:text-guinness-cream sm:w-auto"
              >
                {secondaryLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (onPrimary) void Promise.resolve(onPrimary()).catch(() => {});
                else onOpenChange(false);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-guinness-gold px-4 py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan sm:w-auto"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
