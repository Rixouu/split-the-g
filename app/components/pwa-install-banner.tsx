import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "~/i18n/context";

const STORAGE_INSTALLED = "split-g-pwa-installed";
const STORAGE_SNOOZE_UNTIL = "split-g-pwa-install-snooze-until";
const IOS_FALLBACK_MS = 1800;
const SNOOZE_MS = 21 * 24 * 60 * 60 * 1000;

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: window-controls-overlay)").matches) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iphone|ipod|ipad/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

/** iOS WebKit shells — steps differ from Safari. */
type IosBrowserFlavor = "safari" | "chrome" | "firefox" | "other";

function iosBrowserFlavor(): IosBrowserFlavor {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/CriOS\//i.test(ua) || /EdgiOS\//i.test(ua) || /OPiOS\//i.test(ua)) {
    return "chrome";
  }
  if (/FxiOS\//i.test(ua)) return "firefox";
  if (
    /Safari/i.test(ua) &&
    /Mobile\//i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua)
  ) {
    return "safari";
  }
  return "other";
}

function pwaIosBodyKey(flavor: IosBrowserFlavor): string {
  switch (flavor) {
    case "safari":
      return "pages.home.pwaBannerIosBodySafari";
    case "chrome":
      return "pages.home.pwaBannerIosBodyChrome";
    case "firefox":
      return "pages.home.pwaBannerIosBodyFirefox";
    default:
      return "pages.home.pwaBannerIosBodyGeneric";
  }
}

function readInstalledFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_INSTALLED) === "1";
  } catch {
    return false;
  }
}

function readSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_SNOOZE_UNTIL);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function writeSnooze(): void {
  try {
    localStorage.setItem(STORAGE_SNOOZE_UNTIL, String(Date.now() + SNOOZE_MS));
  } catch {
    /* ignore */
  }
}

function writeInstalled(): void {
  try {
    localStorage.setItem(STORAGE_INSTALLED, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Chrome-style install strip + iOS “Add to Home Screen” hint. Home route only.
 */
export function PwaInstallBanner() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [iosFlavor, setIosFlavor] = useState<IosBrowserFlavor>("other");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    deferredRef.current = deferred;
  }, [deferred]);

  useEffect(() => {
    if (iosHint && typeof navigator !== "undefined") {
      setIosFlavor(iosBrowserFlavor());
    }
  }, [iosHint]);

  const dismiss = useCallback(() => {
    writeSnooze();
    setDeferred(null);
    setIosHint(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (readInstalledFlag()) return;
    if (readSnoozed()) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setIosHint(false);
    };

    const onAppInstalled = () => {
      writeInstalled();
      setDeferred(null);
      setIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const timer = window.setTimeout(() => {
      if (deferredRef.current) return;
      if (isStandaloneDisplay()) return;
      if (readInstalledFlag() || readSnoozed()) return;
      if (isIosDevice()) setIosHint(true);
    }, IOS_FALLBACK_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const showChrome = deferred != null;
  const showIos = iosHint && !showChrome;
  const visible = showChrome || showIos;

  const onInstallClick = async () => {
    if (!deferred || installing) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setInstalling(false);
      setDeferred(null);
    }
  };

  if (!visible) return null;

  const origin =
    typeof window !== "undefined" ? window.location.host : "";

  const shellClass =
    "fixed left-3 right-3 top-[max(0.5rem,env(safe-area-inset-top,0px))] z-40 rounded-2xl border border-[#2A2211] bg-[#14120e] shadow-[0_10px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(212,175,55,0.06)]";

  if (showIos) {
    return (
      <div
        className={`${shellClass} px-3 pb-3.5 pt-3`}
        role="region"
        aria-label={t("pages.home.pwaBannerAria")}
      >
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2rem] items-start gap-x-2.5">
          <img
            src="/web-app-manifest-192x192.png"
            alt=""
            width={44}
            height={44}
            className="mt-0.5 h-11 w-11 rounded-xl border border-guinness-gold/25 bg-guinness-black/60 object-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.4)]"
          />
          <div className="min-w-0 px-0.5 text-center">
            <p className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-guinness-cream">
              {t("pages.home.pwaBannerTitleIos")}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-snug text-guinness-tan/60">
              {t("pages.home.pwaBannerSubtitleIos")}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 items-center justify-center justify-self-end rounded-lg text-guinness-tan/45 transition-colors hover:bg-white/[0.06] hover:text-guinness-cream"
            aria-label={t("pages.home.pwaBannerDismissAria")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="mt-3 border-t border-guinness-gold/10 pt-2.5">
          <p className="text-center text-[10px] font-medium uppercase tracking-wider text-guinness-tan/40">
            {t("pages.home.pwaBannerIosStepsLabel")}
          </p>
          <p className="mx-auto mt-1.5 max-w-[19rem] text-center text-[11px] leading-snug text-guinness-tan/55 text-balance">
            {t(pwaIosBodyKey(iosFlavor))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${shellClass} py-2.5 pl-2 pr-1.5`}
      role="region"
      aria-label={t("pages.home.pwaBannerAria")}
    >
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-2">
        <img
          src="/web-app-manifest-192x192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl border border-[#2A2211] bg-guinness-black/50 object-cover"
        />
        <div className="min-w-0 px-1 text-center">
          <p className="truncate text-[0.9375rem] font-semibold leading-tight text-guinness-cream">
            {t("pages.home.pwaBannerTitleInstall")}
          </p>
          <p className="mt-0.5 truncate text-xs leading-tight text-guinness-tan/55">
            {origin}
          </p>
          <p className="mt-1 hidden text-[10px] leading-tight text-guinness-tan/45 sm:block">
            {t("pages.home.pwaBannerChromeHint")}
          </p>
        </div>
        <button
          type="button"
          disabled={installing}
          onClick={() => void onInstallClick()}
          className="shrink-0 rounded-lg px-2.5 py-2 text-sm font-semibold text-guinness-gold transition-colors hover:text-guinness-tan disabled:opacity-50"
        >
          {installing
            ? t("pages.home.pwaBannerInstalling")
            : t("pages.home.pwaBannerInstall")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-guinness-tan/50 transition-colors hover:bg-white/5 hover:text-guinness-cream"
          aria-label={t("pages.home.pwaBannerDismissAria")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      <p className="mt-2 border-t border-guinness-gold/10 pt-2 text-center text-[10px] leading-snug text-guinness-tan/50 sm:hidden">
        {t("pages.home.pwaBannerChromeHint")}
      </p>
    </div>
  );
}
