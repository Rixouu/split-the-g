import type { BarStat } from "~/routes/pubs";

/** Only this account may edit pub directory fields (hours, promos, map URL). */
export const PUB_DIRECTORY_ADMIN_EMAIL = "admin.rixou@gmail.com";

/** Brand stroke for pub surfaces (dark brown — no light/white borders). */
export const pubStroke = "border-[#322914]";
/** Panel shell without inset top highlight (avoids a faux divider above first content). */
export const pubPanelShell = `rounded-2xl border ${pubStroke} bg-guinness-brown/25 p-4 sm:p-5`;
export const pubPanel = `${pubPanelShell} shadow-[inset_0_1px_0_rgba(212,175,55,0.05)]`;
export const pubPanelMuted = `rounded-xl border ${pubStroke} bg-guinness-black/30 px-3 py-3 sm:px-4 sm:py-3.5`;
export const pubDivider = `border-t ${pubStroke}`;

export interface PubExtraRow {
  distinct_drinkers: number;
  total_pint_spend: number;
  my_pint_spend: number;
}

export interface PubPlaceRow {
  bar_key: string;
  opening_hours: string | null;
  guinness_info: string | null;
  alcohol_promotions: string | null;
  maps_place_url: string | null;
  google_place_id: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface LinkedCompetition {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  path_segment?: string | null;
}

export const PUB_WALL_PAGE_LIMIT = 120;

export function isPubDirectoryAdmin(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase();
  return Boolean(e && e === PUB_DIRECTORY_ADMIN_EMAIL.toLowerCase());
}

/** Accept pasted `/pubs/...` URL or encoded key; returns normalized bar_key. */
export function normalizeBarKeyInput(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    /* keep s */
  }
  const pubsIdx = s.indexOf("/pubs/");
  if (pubsIdx >= 0) s = s.slice(pubsIdx + 6).split(/[?#]/)[0] ?? "";
  return s.trim().toLowerCase();
}

export function mapsSearchUrl(b: BarStat): string {
  const q = [b.display_name, b.sample_address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function numFromDb(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
