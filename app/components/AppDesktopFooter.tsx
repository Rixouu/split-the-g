import { useLocation } from "react-router";
import { useI18n } from "~/i18n/context";
import { shouldShowAppNav } from "~/components/AppNavigation";

/**
 * Slim legal strip — desktop only. No duplicate branding; top nav already carries the product.
 */
export function AppDesktopFooter() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  if (!shouldShowAppNav(pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <footer
      className="hidden shrink-0 border-t border-white/[0.06] md:block"
      aria-label={t("common.footerAria")}
    >
      <div className="mx-auto max-w-6xl px-4 py-2.5 lg:px-8">
        <p className="text-center text-[11px] leading-snug text-guinness-tan/35">
          {t("common.footerCopyright", { year })}
        </p>
      </div>
    </footer>
  );
}
