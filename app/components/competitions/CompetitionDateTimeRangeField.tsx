import { format } from "date-fns";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker, type DateRange } from "react-day-picker";

import "react-day-picker/style.css";
import "~/components/wall/wall-day-picker.css";

const triggerClass =
  "w-full min-h-11 rounded-lg border border-guinness-gold/25 bg-guinness-black/60 px-3 py-2 text-left text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none";

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

function splitDatetimeLocal(v: string): { ymd: string; hm: string } {
  if (!v?.trim()) return { ymd: "", hm: "" };
  const [d, t] = v.trim().split("T");
  return { ymd: d ?? "", hm: t?.slice(0, 5) ?? "" };
}

function mergeDatetimeLocal(ymd: string, hm: string): string {
  if (!ymd) return "";
  const raw = hm || "12:00";
  const [hPart = "12", mPart = "00"] = raw.split(":");
  const hh = String(hPart).padStart(2, "0");
  const mm = String(mPart).padStart(2, "0");
  return `${ymd}T${hh}:${mm}`;
}

function rangeFromDatetimeLocals(
  startLocal: string,
  endLocal: string,
): DateRange | undefined {
  const a = splitDatetimeLocal(startLocal).ymd;
  const b = splitDatetimeLocal(endLocal).ymd;
  const from = a ? parseLocalYmd(a) : undefined;
  if (!from) return undefined;
  const to = b ? parseLocalYmd(b) : undefined;
  return { from, to: to ?? undefined };
}

function formatWindowLabel(
  startLocal: string,
  endLocal: string,
  emptyLabel: string,
): string {
  if (!startLocal || !endLocal) return emptyLabel;
  const a = new Date(startLocal);
  const b = new Date(endLocal);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return emptyLabel;
  }
  return `${format(a, "EEE MMM d, yyyy · h:mm a")} → ${format(b, "EEE MMM d, yyyy · h:mm a")}`;
}

export interface CompetitionDateTimeRangeCopy {
  chooseWindow: string;
  dialogAriaLabel: string;
  timesLocal: string;
  start: string;
  end: string;
  clear: string;
  done: string;
  sectionLabel: string;
  hint: string;
}

const DEFAULT_DATETIME_COPY: CompetitionDateTimeRangeCopy = {
  chooseWindow: "Choose competition window",
  dialogAriaLabel: "Choose competition date range and times",
  timesLocal: "Times (local)",
  start: "Start",
  end: "End",
  clear: "Clear",
  done: "Done",
  sectionLabel: "Competition window",
  hint: "Pick the date range, then set start and end times (your device timezone).",
};

export interface CompetitionDateTimeRangeFieldProps {
  startLocal: string;
  endLocal: string;
  onChange: (start: string, end: string) => void;
  inputClass: string;
  /** Optional UI strings (defaults to English). */
  copy?: Partial<CompetitionDateTimeRangeCopy>;
}

export function CompetitionDateTimeRangeField({
  startLocal,
  endLocal,
  onChange,
  inputClass,
  copy: copyPartial,
}: CompetitionDateTimeRangeFieldProps) {
  const copy = { ...DEFAULT_DATETIME_COPY, ...copyPartial };
  const [open, setOpen] = useState(false);
  const PANEL_W = 280;
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
    let left = r.left;
    if (left + panelW > vw - margin) left = vw - margin - panelW;
    if (left < margin) left = margin;
    const estimatedH = 420;
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

  const startHm = splitDatetimeLocal(startLocal).hm || "12:00";
  const endHm = splitDatetimeLocal(endLocal).hm || "23:59";

  function applyTimes(nextStartHm: string, nextEndHm: string) {
    const sy = splitDatetimeLocal(startLocal).ymd;
    const ey = splitDatetimeLocal(endLocal).ymd;
    if (!sy || !ey) return;
    onChange(mergeDatetimeLocal(sy, nextStartHm), mergeDatetimeLocal(ey, nextEndHm));
  }

  const selected = rangeFromDatetimeLocals(startLocal, endLocal);

  const picker = open ? (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40 md:bg-transparent"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        className="fixed z-[110] w-[min(280px,calc(100vw-24px))] max-h-[min(85vh,480px)] overflow-y-auto overflow-x-hidden rounded-lg border border-guinness-gold/35 bg-[#14110c] p-2 shadow-2xl shadow-black/60"
        style={{ top: popPos.top, left: popPos.left }}
        role="dialog"
        aria-label={copy.dialogAriaLabel}
      >
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={(range: DateRange | undefined) => {
            if (!range?.from) {
              onChange("", "");
              return;
            }
            const fromY = toLocalYmd(range.from);
            const toDate = range.to ?? range.from;
            const toY = toLocalYmd(toDate);
            const sHm = startLocal ? splitDatetimeLocal(startLocal).hm || "12:00" : "12:00";
            const eHm = endLocal ? splitDatetimeLocal(endLocal).hm || "23:59" : "23:59";
            onChange(mergeDatetimeLocal(fromY, sHm), mergeDatetimeLocal(toY, eHm));
          }}
          numberOfMonths={1}
          defaultMonth={selected?.from ?? selected?.to ?? new Date()}
          className="wall-rdp mx-auto w-full max-w-full"
        />
        <div className="mt-3 space-y-2 border-t border-guinness-gold/15 pt-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-guinness-tan/55">
            {copy.timesLocal}
          </p>
          <div className="grid grid-cols-2 gap-2 px-1">
            <div>
              <label
                htmlFor="comp-window-start-time"
                className="type-meta mb-1 block text-guinness-tan/70"
              >
                {copy.start}
              </label>
              <input
                id="comp-window-start-time"
                type="time"
                value={startHm}
                onChange={(e) => applyTimes(e.target.value, endHm)}
                disabled={!splitDatetimeLocal(startLocal).ymd}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="comp-window-end-time"
                className="type-meta mb-1 block text-guinness-tan/70"
              >
                {copy.end}
              </label>
              <input
                id="comp-window-end-time"
                type="time"
                value={endHm}
                onChange={(e) => applyTimes(startHm, e.target.value)}
                disabled={!splitDatetimeLocal(endLocal).ymd}
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-1.5 border-t border-guinness-gold/15 pt-2">
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-guinness-tan/80 hover:bg-guinness-brown/40 hover:text-guinness-cream"
            onClick={() => {
              onChange("", "");
              setOpen(false);
            }}
          >
            {copy.clear}
          </button>
          <button
            type="button"
            className="rounded-md bg-guinness-gold/90 px-2.5 py-1 text-[11px] font-semibold text-guinness-black hover:bg-guinness-tan"
            onClick={() => setOpen(false)}
          >
            {copy.done}
          </button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="type-meta text-guinness-tan/80">{copy.sectionLabel}</span>
      <button
        ref={btnRef}
        type="button"
        className={`${triggerClass} flex items-center justify-between gap-2`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 truncate text-left">
          {formatWindowLabel(startLocal, endLocal, copy.chooseWindow)}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-guinness-gold/70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      <p className="type-meta text-guinness-tan/55">{copy.hint}</p>
      {typeof document !== "undefined" && picker
        ? createPortal(picker, document.body)
        : null}
    </div>
  );
}
