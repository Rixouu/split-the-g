import { Navigate } from "react-router";
import { useIsDesktopMd } from "~/utils/useDesktopMd";

/**
 * Mobile: stay on `/profile` (layout shows hub menu). Desktop: land on Progress.
 * Server snapshot is mobile-first so SSR does not redirect small viewports away from the hub.
 */
export default function ProfileIndex() {
  const isDesktop = useIsDesktopMd();
  if (isDesktop) {
    return <Navigate to="/profile/progress" replace />;
  }
  return null;
}
