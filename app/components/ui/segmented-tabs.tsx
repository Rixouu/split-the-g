import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import { NavLink } from "react-router";
import { segmentedTabGroupChromeClass } from "~/routes/profile/profile-shared";

export type SegmentedTabItem = {
  value: string;
  label: ReactNode;
  /** When using role="tablist", overrides shared `panelId` for aria-controls. */
  panelId?: string;
};

export type SegmentedTabsLinkItem = {
  value: string;
  to: string;
  label: ReactNode;
  end?: boolean;
};

type IndicatorRect = { left: number; top: number; width: number; height: number };

const triggerShellEqual =
  "flex min-h-11 flex-1 basis-0 min-w-0 items-center justify-center rounded-lg px-1.5 py-2 text-center text-sm font-semibold leading-tight tracking-normal transition-colors sm:px-2.5";

const triggerShellGrid =
  "flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg px-1.5 py-2 text-center text-sm font-semibold leading-tight tracking-normal transition-colors sm:px-2.5";

function triggerTextClass(active: boolean): string {
  return active
    ? "text-guinness-black"
    : "text-guinness-tan/75 hover:text-guinness-cream";
}

function useSegmentedIndicator(
  activeIndex: number,
  itemCount: number,
): readonly [
  RefObject<HTMLDivElement | null>,
  MutableRefObject<(HTMLDivElement | null)[]>,
  IndicatorRect | null,
] {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const safeIndex = Math.min(
      Math.max(0, activeIndex),
      Math.max(0, itemCount - 1),
    );
    const cell = cellRefs.current[safeIndex];
    if (!root || !cell) {
      setIndicator(null);
      return;
    }
    const rr = root.getBoundingClientRect();
    const rc = cell.getBoundingClientRect();
    setIndicator({
      left: rc.left - rr.left,
      top: rc.top - rr.top,
      width: rc.width,
      height: rc.height,
    });
  }, [activeIndex, itemCount]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure]);

  return [rootRef, cellRefs, indicator] as const;
}

function assignCellRef(
  cellRefs: MutableRefObject<(HTMLDivElement | null)[]>,
  index: number,
  el: HTMLDivElement | null,
) {
  cellRefs.current[index] = el;
}

export type SegmentedTabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: SegmentedTabItem[];
  className?: string;
  /** Applied with chrome (e.g. `mb-6 flex w-full`). Default includes flex row. */
  layoutClassName?: string;
  /** `rowEqual` — flex-1 segments. `gridCell` — full-width grid cells. */
  variant?: "rowEqual" | "gridCell";
  "aria-label"?: string;
  role?: "tablist" | "none";
  tabIdPrefix?: string;
  panelId?: string;
};

/**
 * Segmented control with animated sliding gold indicator (Compete / Ranks tab chrome).
 */
export function SegmentedTabs({
  value,
  onValueChange,
  items,
  className = "",
  layoutClassName = "flex w-full",
  variant = "rowEqual",
  "aria-label": ariaLabel,
  role = "none",
  tabIdPrefix,
  panelId,
}: SegmentedTabsProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );
  const [rootRef, cellRefs, indicator] = useSegmentedIndicator(
    activeIndex,
    items.length,
  );

  const shell = variant === "rowEqual" ? triggerShellEqual : triggerShellGrid;

  return (
    <div
      ref={rootRef}
      className={`relative ${segmentedTabGroupChromeClass} ${layoutClassName} ${className}`.trim()}
      aria-label={ariaLabel}
      role={role === "tablist" ? "tablist" : undefined}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute z-0 rounded-lg bg-guinness-gold shadow-sm motion-safe:transition-[left,top,width,height] motion-safe:duration-300 motion-safe:ease-out ${
          indicator && indicator.width > 0 ? "opacity-100" : "opacity-0"
        }`}
        style={
          indicator
            ? {
                left: indicator.left,
                top: indicator.top,
                width: indicator.width,
                height: indicator.height,
              }
            : undefined
        }
      />
      {items.map((item, index) => {
        const isActive = item.value === value;
        const tabId = tabIdPrefix ? `${tabIdPrefix}-${item.value}` : undefined;
        return (
          <div
            key={item.value}
            ref={(el) => assignCellRef(cellRefs, index, el)}
            className="relative z-[1] min-w-0"
          >
            <button
              type="button"
              role={role === "tablist" ? "tab" : undefined}
              id={tabId}
              aria-selected={role === "tablist" ? isActive : undefined}
              aria-controls={
                role === "tablist" ? item.panelId ?? panelId : undefined
              }
              onClick={() => onValueChange(item.value)}
              className={`${shell} ${triggerTextClass(isActive)} outline-none ring-guinness-gold/40 focus-visible:ring-2`}
            >
              {item.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export type SegmentedTabsNavProps = {
  items: SegmentedTabsLinkItem[];
  activeValue: string;
  className?: string;
  layoutClassName?: string;
  "aria-label"?: string;
  variant?: "rowEqual" | "gridCell";
};

/**
 * Same segmented UI as {@link SegmentedTabs}, using {@link NavLink} per segment.
 */
export function SegmentedTabsNav({
  items,
  activeValue,
  className = "",
  layoutClassName = "flex w-full",
  "aria-label": ariaLabel,
  variant = "gridCell",
}: SegmentedTabsNavProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.value === activeValue),
  );
  const [rootRef, cellRefs, indicator] = useSegmentedIndicator(
    activeIndex,
    items.length,
  );

  const shell = variant === "rowEqual" ? triggerShellEqual : triggerShellGrid;

  return (
    <nav
      ref={rootRef}
      className={`relative ${segmentedTabGroupChromeClass} ${layoutClassName} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute z-0 rounded-lg bg-guinness-gold shadow-sm motion-safe:transition-[left,top,width,height] motion-safe:duration-300 motion-safe:ease-out ${
          indicator && indicator.width > 0 ? "opacity-100" : "opacity-0"
        }`}
        style={
          indicator
            ? {
                left: indicator.left,
                top: indicator.top,
                width: indicator.width,
                height: indicator.height,
              }
            : undefined
        }
      />
      {items.map((item, index) => (
        <div
          key={item.value}
          ref={(el) => assignCellRef(cellRefs, index, el)}
          className="relative z-[1] min-w-0"
        >
          <NavLink
            to={item.to}
            end={item.end}
            prefetch="intent"
            viewTransition
            className={({ isActive }) =>
              `${shell} block w-full ${triggerTextClass(isActive)} outline-none ring-guinness-gold/40 focus-visible:ring-2`
            }
          >
            {item.label}
          </NavLink>
        </div>
      ))}
    </nav>
  );
}

/** Longest matching profile section `to` for the current pathname. */
export function resolveProfileSectionTab(
  pathname: string,
  sectionTos: readonly string[],
): string {
  let best = sectionTos[0] ?? "/profile";
  let bestLen = 0;
  for (const to of sectionTos) {
    if (pathname === to || pathname.startsWith(`${to}/`)) {
      if (to.length >= bestLen) {
        best = to;
        bestLen = to.length;
      }
    }
  }
  return best;
}
