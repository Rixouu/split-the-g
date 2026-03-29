import { HREFLANG_BY_LOCALE, SUPPORTED_LOCALES } from "~/i18n/config";
import { stripLocalePrefix } from "~/i18n/paths";

export type HreflangDescriptor = { hrefLang: string; href: string };

/**
 * Alternate language URLs for the current path (for `link rel="alternate" hreflang`).
 */
export function hreflangDescriptors(
  siteOrigin: string,
  pathname: string,
): HreflangDescriptor[] {
  const normalizedOrigin = siteOrigin.replace(/\/$/, "");
  const rest = stripLocalePrefix(pathname);
  const suffix = rest === "/" ? "/" : rest.startsWith("/") ? rest : `/${rest}`;

  const forLocale = (loc: string) =>
    suffix === "/"
      ? `${normalizedOrigin}/${loc}/`
      : `${normalizedOrigin}/${loc}${suffix}`;

  const links: HreflangDescriptor[] = SUPPORTED_LOCALES.map((loc) => ({
    hrefLang: HREFLANG_BY_LOCALE[loc] ?? loc,
    href: forLocale(loc),
  }));

  links.push({
    hrefLang: "x-default",
    href: forLocale("en"),
  });

  return links;
}
