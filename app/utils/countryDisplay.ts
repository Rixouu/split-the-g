import countries from "i18n-iso-countries";
import type { LocaleData } from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

/**
 * The package's `browser` entry is `index.js` (empty `registeredLocales`).
 * Node uses `entry-node.js` which registers every lang — so SSR had names but
 * the client bundle did not, and `getNames("en")` returned `{}` after hydrate.
 */
countries.registerLocale(enLocale as LocaleData);

export interface CountryOption {
  code: string;
  name: string;
}

/**
 * Full ISO 3166-1 alpha-2 list with English names (after `registerLocale` above).
 */
export function getCountryOptions(): CountryOption[] {
  const names = countries.getNames("en", { select: "official" });
  return Object.entries(names)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Unicode regional-indicator flag from ISO 3166-1 alpha-2 (e.g. TH → 🇹🇭). */
export function flagEmojiFromIso2(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const u = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(u)) return "";
  return String.fromCodePoint(
    ...[...u].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)),
  );
}
