import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 768px)";

function subscribeDesktopMd(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getDesktopMdSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** Tailwind `md` breakpoint; server snapshot is mobile-first (`false`). */
export function useIsDesktopMd() {
  return useSyncExternalStore(
    subscribeDesktopMd,
    getDesktopMdSnapshot,
    () => false,
  );
}
