import type { SupportedLocale } from "./config";
import { DEFAULT_LOCALE, isSupportedLocale } from "./config";

export function langFromParams(params: { lang?: string }): SupportedLocale {
  const l = params.lang;
  return l && isSupportedLocale(l) ? l : DEFAULT_LOCALE;
}
