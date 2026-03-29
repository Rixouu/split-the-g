import { format } from "date-fns";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker, type DateRange } from "react-day-picker";

import "react-day-picker/style.css";
import "./wall-day-picker.css";

/**
 * Match native filter `<select>` chevron placement: `.stg-native-select-chevron` draws at
 * `right: 0.75rem`. Using `pr-10` + flex `justify-between` pinned the calendar to the inner
 * edge of that padding (~40px) — misaligned vs dropdowns. Absolute `right-3` aligns the glyph.
 */
const dateRangeTriggerClass =
  "relative flex w-full min-h-11 items-center rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-left text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none sm:min-w-[10.5rem]";

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalYmd(ymd: string): Date | undefined {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d);
}

function rangeFromStrings(
  dateFrom: string,
  dateTo: string,
): DateRange | undefined {
  const from = dateFrom.trim() ? parseLocalYmd(dateFrom.trim()) : undefined;
  const to = dateTo.trim() ? parseLocalYmd(dateTo.trim()) : undefined;
  if (!from) return undefined;
  return { from, to: to ?? undefined };
}

function formatButtonLabel(dateFrom: string, dateTo: string): string {
  const from = dateFrom.trim() ? parseLocalYmd(dateFrom.trim()) : undefined;
  const to = dateTo.trim() ? parseLocalYmd(dateTo.trim()) : undefined;
  if (!from) return "All dates";
  if (!to) return `From ${format(from, "MMM d, yyyy")}`;
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}

export interface WallDateRangeFieldProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

export function WallDateRangeField({
  dateFrom,
  dateTo,
  onChange,
}: WallDateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  /** Matches compact calendar width (7 × ~30px cells + padding). */
  const PANEL_W = 264;

  const [popPos, setPopPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 12;
    const panelW = Math.min(PANEL_W, vw - margin * 2);
    /* Prefer aligning popover with the trigger’s left edge (filter column). */
    let left = r.left;
    if (left + panelW > vw - margin) left = vw - margin - panelW;
    if (left < margin) left = margin;

    const estimatedH = 320;
    let top = r.bottom + 8;
    if (top + estimatedH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - estimatedH - 8);
    }

    setPopPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onScrollResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open, updatePosition]);

  const selected = rangeFromStrings(dateFrom, dateTo);

  const picker = open ? (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40 md:bg-transparent"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        className="fixed z-[110] w-[min(264px,calc(100vw-24px))] max-h-[min(80vh,400px)] overflow-y-auto overflow-x-hidden rounded-lg border border-guinness-gold/35 bg-[#14110c] p-2 shadow-2xl shadow-black/60"
        style={{
          top: popPos.top,
          left: popPos.left,
        }}
        role="dialog"
        aria-label="Choose date range"
      >
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={(range: DateRange | undefined) => {
            if (!range?.from) {
              onChange("", "");
              return;
            }
            const fromStr = toLocalYmd(range.from);
            const toStr = range.to ? toLocalYmd(range.to) : "";
            onChange(fromStr, toStr);
            if (range.from && range.to) setOpen(false);
          }}
          numberOfMonths={1}
          defaultMonth={selected?.from ?? selected?.to ?? new Date()}
          className="wall-rdp mx-auto w-full max-w-full"
        />
        <div className="mt-1.5 flex justify-end gap-1.5 border-t border-guinness-gold/15 pt-1.5">
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-guinness-tan/80 hover:bg-guinness-brown/40 hover:text-guinness-cream"
            onClick={() => {
              onChange("", "");
              setOpen(false);
            }}
          >
            Clear range
          </button>
          <button
            type="button"
            className="rounded-md bg-guinness-gold/90 px-2.5 py-1 text-[11px] font-semibold text-guinness-black hover:bg-guinness-tan"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="type-meta text-guinness-tan/80">Date range</span>
      <button
        ref={btnRef}
        type="button"
        className={dateRangeTriggerClass}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 flex-1 truncate pr-9">
          {formatButtonLabel(dateFrom, dateTo)}
        </span>
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-guinness-gold/70"
          aria-hidden
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </span>
      </button>
      {typeof document !== "undefined" && picker
        ? createPortal(picker, document.body)
        : null}
    </div>
  );
}
