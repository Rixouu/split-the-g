import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CountryOption } from "~/utils/countryDisplay";
import { flagEmojiFromIso2 } from "~/utils/countryDisplay";

export interface ProfileCountryPickerProps {
  id: string;
  value: string;
  onChange: (code: string) => void;
  options: CountryOption[];
  notSetLabel: string;
  fieldLabel: string;
  searchPlaceholder: string;
  noMatchesLabel: string;
  triggerClassName: string;
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function ProfileCountryPicker({
  id,
  value,
  onChange,
  options,
  notSetLabel,
  fieldLabel,
  searchPlaceholder,
  noMatchesLabel,
  triggerClassName,
}: ProfileCountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const selectedLabel = useMemo(() => {
    if (!value) return notSetLabel;
    const row = options.find((c) => c.code === value);
    return row ? row.name : value;
  }, [value, options, notSetLabel]);

  const q = normalizeQuery(query);
  const showNotSetRow = !q || notSetLabel.toLowerCase().includes(q);

  const filteredCountries = useMemo(() => {
    if (!q) return options;
    return options.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.code.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      const el = rootRef.current;
      if (!el || !(ev.target instanceof Node) || el.contains(ev.target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  const inputRowClass =
    "w-full rounded-md border border-guinness-gold/20 bg-guinness-black/70 px-2.5 py-2 text-sm text-guinness-cream placeholder:text-guinness-tan/45 focus:border-guinness-gold focus:outline-none";
  const rowClass =
    "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-guinness-cream hover:bg-guinness-gold/10";

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        id={id}
        type="button"
        className={triggerClassName}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-controls={listboxId}
        onClick={() => {
          setOpen((wasOpen) => {
            setQuery("");
            return !wasOpen;
          });
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {value ? (
            <span className="shrink-0" title={value} aria-hidden>
              {flagEmojiFromIso2(value)}
            </span>
          ) : null}
          <span className="min-w-0 truncate">{selectedLabel}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-guinness-tan/70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-[min(22rem,calc(100vh-8rem))] overflow-hidden rounded-lg border border-guinness-gold/25 bg-guinness-black/95 shadow-lg backdrop-blur-md">
          <div className="border-b border-guinness-gold/15 p-2">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={inputRowClass}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              title={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label={fieldLabel}
            className="max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto overscroll-contain py-1"
          >
            {showNotSetRow ? (
              <button
                type="button"
                role="option"
                aria-selected={value === "" ? "true" : "false"}
                className={`${rowClass} ${value === "" ? "bg-guinness-gold/15" : ""}`}
                onClick={() => pick("")}
              >
                <span className="text-guinness-tan/80">{notSetLabel}</span>
              </button>
            ) : null}
            {filteredCountries.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-guinness-tan/65">
                {noMatchesLabel}
              </p>
            ) : (
              filteredCountries.map((c) => {
                const selected = c.code === value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={selected ? "true" : "false"}
                    className={`${rowClass} ${selected ? "bg-guinness-gold/15" : ""}`}
                    onClick={() => pick(c.code)}
                  >
                    <span className="shrink-0" title={c.code} aria-hidden>
                      {flagEmojiFromIso2(c.code)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
