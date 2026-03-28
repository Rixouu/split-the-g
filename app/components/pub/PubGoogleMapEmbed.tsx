import { useEffect, useState } from "react";

const embedBorder =
  "rounded-xl border border-[#372C16] bg-guinness-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

/**
 * Embedded map via Google Maps Embed API (Search mode).
 * Requires `VITE_GOOGLE_MAPS_API_KEY` and Maps Embed API enabled for the key.
 * @see https://developers.google.com/maps/documentation/embed/get-started
 */
export function PubGoogleMapEmbed({
  searchQuery,
  title,
}: {
  searchQuery: string;
  title: string;
}) {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setChecked(true);
      return;
    }
    const key =
      typeof window !== "undefined"
        ? window.ENV?.GOOGLE_PLACES_API_KEY?.trim() ?? ""
        : "";
    if (key) {
      setIframeSrc(
        `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`,
      );
    }
    setChecked(true);
  }, [searchQuery]);

  if (!searchQuery.trim()) {
    return (
      <div
        className={`flex aspect-[4/3] max-h-[min(22rem,50vh)] min-h-[12rem] w-full items-center justify-center ${embedBorder}`}
      >
        <p className="type-meta max-w-xs px-4 text-center text-guinness-tan/60">
          Add an address on pour pages to improve map search for this pub.
        </p>
      </div>
    );
  }

  if (!checked) {
    return (
      <div
        className={`aspect-[4/3] max-h-[min(22rem,50vh)] min-h-[12rem] w-full animate-pulse ${embedBorder}`}
        aria-hidden
      />
    );
  }

  if (!iframeSrc) {
    return (
      <div
        className={`flex aspect-[4/3] max-h-[min(22rem,50vh)] min-h-[12rem] w-full flex-col items-center justify-center gap-2 px-4 text-center ${embedBorder}`}
      >
        <p className="type-meta text-guinness-tan/70">
          For an embedded map, add{" "}
          <code className="rounded bg-guinness-black/60 px-1 text-guinness-gold">
            VITE_GOOGLE_MAPS_API_KEY
          </code>{" "}
          and enable{" "}
          <span className="text-guinness-cream">Maps Embed API</span> for that
          key.
        </p>
        <p className="type-meta text-guinness-tan/50">
          You can still open the location in Google Maps from the button below.
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${embedBorder}`}>
      <iframe
        title={title}
        src={iframeSrc}
        className="aspect-[4/3] max-h-[min(22rem,50vh)] min-h-[12rem] w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
