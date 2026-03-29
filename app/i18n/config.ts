/** BCP 47 language tags for hreflang (where they differ from URL segment). */
export const HREFLANG_BY_LOCALE: Record<string, string> = {
  en: "en",
  th: "th",
  fr: "fr",
  es: "es",
  de: "de",
  it: "it",
  ja: "ja",
};

export const SUPPORTED_LOCALES = [
  "en",
  "th",
  "fr",
  "es",
  "de",
  "it",
  "ja",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** html lang attribute */
export function htmlLangAttribute(locale: SupportedLocale): string {
  if (locale === "ja") return "ja";
  return locale;
}
