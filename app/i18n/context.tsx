import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMatches } from "react-router";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "./config";

export type I18nContextValue = {
  lang: SupportedLocale;
  messages: Record<string, string>;
  t: (key: string) => string;
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
  const t = useCallback(
    (key: string) => messages[key] ?? key,
    [messages],
  );
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
