import { Navigate, useParams } from "react-router";
import { langFromParams } from "~/i18n/lang-param";
import { localizePath } from "~/i18n/paths";
import { useIsDesktopMd } from "~/utils/useDesktopMd";

/**
 * Mobile: stay on `/profile` (layout shows hub menu). Desktop: land on Progress.
 * Server snapshot is mobile-first so SSR does not redirect small viewports away from the hub.
 */
export default function ProfileIndex() {
  const params = useParams();
  const isDesktop = useIsDesktopMd();
  if (isDesktop) {
    return (
      <Navigate
        to={localizePath("/profile/progress", langFromParams(params))}
        replace
      />
    );
  }
  return null;
}
