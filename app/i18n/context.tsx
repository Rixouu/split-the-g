import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMatches } from "react-router";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from "./config";
import { createTranslator, makeTFromFlat } from "./load-messages";
import type { TranslateFn } from "./translate";

export type I18nContextValue = {
  lang: SupportedLocale;
  messages: Record<string, string>;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: SupportedLocale;
  messages: Record<string, string>;
  children: ReactNode;
}) {
  const t = useMemo(() => makeTFromFlat(messages), [messages]);
  const value = useMemo(
    () => ({ lang, messages, t }),
    [lang, messages, t],
  );
  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a locale route (I18nProvider).");
  }
  return ctx;
}

/**
 * Locale from the active `lang-layout` loader, or default when outside
 * (e.g. root shell, API).
 */
export function useOptionalLang(): SupportedLocale {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const data = matches[i]?.data as { lang?: string } | undefined;
    if (data?.lang && isSupportedLocale(data.lang)) return data.lang;
  }
  return DEFAULT_LOCALE;
}

/** For `AppNavigation`, global toasts, and other components outside `I18nProvider`. */
export function useTChrome(): TranslateFn {
  const lang = useOptionalLang();
  return useMemo(() => createTranslator(lang), [lang]);
}
