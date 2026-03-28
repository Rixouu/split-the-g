/** Unicode regional-indicator flag from ISO 3166-1 alpha-2 (e.g. TH → 🇹🇭). */
export function flagEmojiFromIso2(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const u = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(u)) return "";
  return String.fromCodePoint(
    ...[...u].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)),
  );
}

export interface CountryOption {
  code: string;
  name: string;
}

/** Sorted list for profile country select (browser Intl; fallback for SSR/tests). */
export function getCountryOptions(): CountryOption[] {
  const fallback: CountryOption[] = [
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "IE", name: "Ireland" },
    { code: "TH", name: "Thailand" },
    { code: "AU", name: "Australia" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "ES", name: "Spain" },
    { code: "IT", name: "Italy" },
    { code: "NL", name: "Netherlands" },
    { code: "BE", name: "Belgium" },
    { code: "CA", name: "Canada" },
    { code: "JP", name: "Japan" },
    { code: "SG", name: "Singapore" },
  ].sort((a, b) => a.name.localeCompare(b.name));

  try {
    const IntlObj = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };
    if (typeof IntlObj.supportedValuesOf !== "function") return fallback;

    const codes = IntlObj
      .supportedValuesOf("region")
      .filter((c) => typeof c === "string" && c.length === 2);
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return codes
      .map((code) => ({
        code,
        name: dn.of(code) ?? code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return fallback;
  }
}
