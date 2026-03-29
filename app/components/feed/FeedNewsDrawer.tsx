import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedNewsItem } from "~/utils/feedRss";
import { useI18n } from "~/i18n/context";
import { formatDistanceToNow } from "date-fns";

interface FeedNewsDrawerProps {
  item: FeedNewsItem | null;
  onClose: () => void;
}

export function FeedNewsDrawer({ item, onClose }: FeedNewsDrawerProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [item]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    if (item) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, handleClose]);

  if (!item) return null;

  const rel = (() => {
    const d = new Date(item.publishedAt).getTime();
    if (!Number.isFinite(d)) return "";
    return formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true });
  })();

  const panel = (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-[200] flex transition-colors duration-280 ${
        visible ? "bg-black/70" : "bg-black/0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === backdropRef.current) handleClose();
      }}
    >
      <div className="flex-1" />
      <aside
        className={`relative flex h-full w-full max-w-lg flex-col border-l border-[#322914] bg-guinness-black shadow-2xl transition-transform duration-280 ease-out sm:max-w-md md:max-w-lg ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#322914] px-5 py-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-guinness-gold/80">
            {item.source}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#322914] bg-guinness-brown/30 text-guinness-tan/80 transition-colors hover:bg-guinness-brown/50"
            aria-label={t("pages.feed.drawerClose")}
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          <h2 className="text-xl font-bold leading-snug text-guinness-cream sm:text-2xl">
            {item.title}
          </h2>
          {rel ? (
            <p className="mt-2 text-xs text-guinness-tan/55">{rel}</p>
          ) : null}
          {item.summary ? (
            <p className="mt-5 text-sm leading-relaxed text-guinness-tan/80">
              {item.summary}
            </p>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-guinness-tan/50 italic">
              {t("pages.feed.drawerNoSummary")}
            </p>
          )}
        </div>

        <footer className="border-t border-[#322914] px-5 py-4">
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-guinness-gold px-5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan"
          >
            {t("pages.feed.drawerReadOn", { source: item.source })}
          </a>
          <p className="mt-2 text-center text-[10px] text-guinness-tan/40">
            {t("pages.feed.drawerExternal")}
          </p>
        </footer>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
