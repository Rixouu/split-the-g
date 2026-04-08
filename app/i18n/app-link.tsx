import {
  Link,
  NavLink,
  type LinkProps,
  type NavLinkProps,
  type To,
} from "react-router";
import { localizePath } from "./paths";
import { useOptionalLang } from "./context";

function localizeTo(to: To, lang: ReturnType<typeof useOptionalLang>): To {
  if (typeof to === "string") {
    if (/^https?:\/\//i.test(to) || to.startsWith("mailto:")) return to;
    return localizePath(to, lang);
  }
  const pathname = to.pathname;
  if (pathname == null) return to;
  return {
    ...to,
    pathname: localizePath(pathname, lang),
  };
}

/** Internal app paths — prefixes `/:lang`. External URLs unchanged. */
export function AppLink({ to, ...props }: LinkProps) {
  const lang = useOptionalLang();
  return <Link to={localizeTo(to, lang)} reloadDocument {...props} />;
}

/** Localized link that intentionally performs a full document navigation. */
export function AppDocumentLink({ to, ...props }: LinkProps) {
  const lang = useOptionalLang();
  return <Link to={localizeTo(to, lang)} reloadDocument {...props} />;
}

export function AppNavLink({ to, ...props }: NavLinkProps) {
  const lang = useOptionalLang();
  return <NavLink to={localizeTo(to, lang)} reloadDocument {...props} />;
}

/**
 * For chrome rendered outside `I18nProvider` (e.g. `AppNavigation`).
 * Full document navigation avoids broken client-side data requests on some hosts
 * (split server bundles) while keeping locale-prefixed `to` targets.
 */
export function AppShellNavLink({ to, ...props }: NavLinkProps) {
  const lang = useOptionalLang();
  return (
    <NavLink to={localizeTo(to, lang)} reloadDocument {...props} />
  );
}
