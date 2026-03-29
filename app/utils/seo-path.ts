import { langFromParams } from "~/i18n/lang-param";
import { localizePath } from "~/i18n/paths";

/** Canonical path segment for `seoMeta` / `og:url` including `/:lang` prefix. */
export function seoPath(
  params: { lang?: string } | undefined,
  pathWithoutLocale: string,
): string {
  const raw = pathWithoutLocale.startsWith("/")
    ? pathWithoutLocale
    : `/${pathWithoutLocale}`;
  return localizePath(raw, langFromParams(params ?? {}));
}
