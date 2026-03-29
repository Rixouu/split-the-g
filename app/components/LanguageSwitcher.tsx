import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "~/i18n/config";
import { useTChrome } from "~/i18n/context";
import { localizePath, stripLocalePrefix } from "~/i18n/paths";

const triggerDesk =
  "inline-flex items-center gap-1.5 rounded-full border border-guinness-gold/20 bg-guinness-black/40 px-2.5 py-1.5 text-xs font-semibold text-guinness-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-guinness-gold/40 hover:bg-guinness-gold/10 hover:text-guinness-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinness-gold";

const triggerMob =
  "relative z-0 flex min-h-[2rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-visible rounded-lg border border-transparent px-1 py-1 text-[9px] font-semibold uppercase leading-none tracking-wide text-guinness-tan/55 outline-none transition-colors hover:text-guinness-cream focus-visible:ring-2 focus-visible:ring-guinness-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-guinness-black";

const panelBase =
  "z-[90] min-w-[10.5rem] rounded-xl border border-guinness-gold/25 bg-[#120f09] py-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(197,160,89,0.1)]";

function GlobeIcon({ className = "" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ChevronIcon({ open, className = "" }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${open ? "rotate-180" : ""}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export type LanguageSwitcherVariant = "desktop" | "mobile";

export function LanguageSwitcher({
  variant = "desktop",
  className = "",
}: {
  variant?: LanguageSwitcherVariant;
  className?: string;
}) {
  const t = useTChrome();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const rest = stripLocalePrefix(pathname);
  const pathWithoutLocale = rest === "" ? "/" : rest;

  const current =
    SUPPORTED_LOCALES.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)) ??
    "en";

  const pick = useCallback(
    (next: SupportedLocale) => {
      if (!SUPPORTED_LOCALES.includes(next)) return;
      const target = localizePath(pathWithoutLocale, next) + search + hash;
      setOpen(false);
      void navigate(target, { replace: false, viewTransition: true });
    },
    [hash, navigate, pathWithoutLocale, search],
  );

  useEffect(() => {
    if (!open) return;
    function onDocMouse(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass = variant === "desktop" ? triggerDesk : triggerMob;
  const currentLabel = t(`languages.${current}`);

  return (
    <div
      ref={rootRef}
      className={`relative ${open ? "z-[90]" : "z-10"} ${className}`.trim()}
    >
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={
          variant === "desktop"
            ? `${t("languages.menuTitle")}: ${currentLabel}`
            : `${t("languages.menuTitle")} (${currentLabel})`
        }
        onClick={() => setOpen((v) => !v)}
      >
        {variant === "desktop" ? (
          <>
            <GlobeIcon className="h-4 w-4 shrink-0 text-guinness-gold/90" aria-hidden />
            <span className="max-w-[7rem] truncate sm:max-w-[9rem]" aria-hidden>
              {currentLabel}
            </span>
            <ChevronIcon open={open} className="h-3.5 w-3.5 shrink-0 text-guinness-tan/60" />
          </>
        ) : (
          <>
            <GlobeIcon className="mx-auto h-5 w-5 text-guinness-gold/85" aria-hidden />
            <span className="w-full text-center leading-none" aria-hidden>
              {t("languages.menuShort")}
            </span>
          </>
        )}
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("languages.menuTitle")}
          className={
            variant === "desktop"
              ? `${panelBase} absolute right-0 top-full mt-2 w-[min(17rem,calc(100vw-2rem))]`
              : `${panelBase} absolute bottom-full left-1/2 mb-2 w-[min(17rem,calc(100vw-2rem))] -translate-x-1/2`
          }
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const selected = loc === current;
            return (
              <li key={loc} role="presentation">
                <button
                  type="button"
                  role="option"
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    selected
                      ? "bg-guinness-gold/15 font-semibold text-guinness-gold"
                      : "text-guinness-cream hover:bg-guinness-gold/10"
                  }`}
                  onClick={() => pick(loc)}
                >
                  <span>{t(`languages.${loc}`)}</span>
                  {selected ? (
                    <span className="text-xs font-bold text-guinness-gold" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
