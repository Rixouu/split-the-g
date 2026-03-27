import { NavLink, useLocation } from "react-router";

/** Prefetch loader payloads and lazy chunks on hover, focus, or touch (before click). */
const LINK_PREFETCH = "intent" as const;

const primaryItems: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Pour", end: true },
  { to: "/feed", label: "Feed" },
  { to: "/competitions", label: "Compete" },
  { to: "/pubs", label: "Pubs" },
  { to: "/profile", label: "Me" },
];

/** Desktop “More” nav */
const secondaryItems: { to: string; label: string }[] = [
  { to: "/wall", label: "Wall" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/faq", label: "FAQ" },
];

/** Mobile dock second row — matches desktop “More” links (compact labels where needed) */
const mobileSecondaryItems: { to: string; label: string }[] = [
  { to: "/wall", label: "Wall" },
  { to: "/leaderboard", label: "Ranks" },
  { to: "/faq", label: "FAQ" },
];

/** Mobile dock: four corner tabs; Pour is the center FAB */
const mobileDockItems: { to: string; label: string }[] = [
  { to: "/feed", label: "Feed" },
  { to: "/competitions", label: "Compete" },
  { to: "/pubs", label: "Pubs" },
  { to: "/profile", label: "Me" },
];

function IconFeed({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path d="M8 21h8M12 17v4M6 3h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V3zM14 3v2a2 2 0 0 0 2 2h1M10 3v2a2 2 0 0 1-2 2H7" />
    </svg>
  );
}

function IconPint({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path d="M8 2h6l1 10H7L8 2zM7 12h10v3a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-3zM5 22h14" />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

/** Stacked frames — reads as photo gallery / collection */
function IconWallGallery({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <rect x="7" y="3" width="14" height="14" rx="2" />
      <path d="M10 8.5h8M10 11.5h6" opacity={0.85} />
      <circle cx="17" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Podium ranks — center bar tallest */
function IconPodium({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 18V12h4v6M10 18V8h4v10M16 18v-4h4v4" />
      <path d="M3 18.5h18" />
      <path d="M11 6.5h2M12 5.5v2" />
    </svg>
  );
}

function IconHelpCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.2-1.7c.6.6.9 1.4.8 2.2-.1 1.2-1 2-2.5 2.5V14" />
      <path d="M12 16.5h.01" strokeWidth={2.5} />
    </svg>
  );
}

function secondaryDockIcon(to: string, className: string) {
  switch (to) {
    case "/wall":
      return <IconWallGallery className={className} />;
    case "/leaderboard":
      return <IconPodium className={className} />;
    case "/faq":
      return <IconHelpCircle className={className} />;
    default:
      return null;
  }
}

const dockIconClass = "h-[1.125rem] w-[1.125rem] shrink-0";

function dockIconFor(to: string) {
  switch (to) {
    case "/feed":
      return <IconFeed className={dockIconClass} />;
    case "/competitions":
      return <IconTrophy className={dockIconClass} />;
    case "/pubs":
      return <IconPint className={dockIconClass} />;
    case "/profile":
      return <IconUser className={dockIconClass} />;
    default:
      return null;
  }
}

const deskPill =
  "rounded-full px-3.5 py-2 text-sm font-medium tracking-tight transition-all duration-200 md:px-4";
const deskActive =
  "bg-guinness-gold text-guinness-black shadow-[0_0_20px_rgba(179,139,45,0.25)]";
const deskIdle =
  "text-guinness-tan/85 hover:bg-guinness-gold/10 hover:text-guinness-cream";

const mobItem =
  "relative flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[9px] font-bold uppercase leading-tight tracking-wide outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-guinness-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-guinness-black sm:text-[10px]";
const mobActive =
  "text-guinness-gold bg-guinness-gold/[0.08] shadow-inner ring-1 ring-guinness-gold/35 ring-inset";
const mobIdle = "text-guinness-tan/55 hover:text-guinness-cream active:scale-[0.98]";

export function shouldShowAppNav(pathname: string): boolean {
  if (pathname === "/") return true;
  if (
    pathname === "/feed" ||
    pathname === "/competitions" ||
    pathname.startsWith("/competitions/") ||
    pathname === "/profile" ||
    pathname === "/pubs" ||
    pathname === "/faq"
  ) {
    return true;
  }
  if (pathname.startsWith("/pour/")) return true;
  if (pathname.startsWith("/score/")) return true;
  if (pathname === "/wall" || pathname === "/collage") return true;
  if (
    pathname === "/leaderboard" ||
    pathname === "/countryleaderboard" ||
    pathname === "/past24hrleaderboard"
  ) {
    return true;
  }
  return false;
}

/** @deprecated use shouldShowAppNav */
export const shouldShowMobileNav = shouldShowAppNav;

export function AppNavigation() {
  const { pathname } = useLocation();

  if (!shouldShowAppNav(pathname)) return null;

  return (
    <>
      {/* Desktop — glass strip + pill cluster */}
      <header
        className="fixed top-0 left-0 right-0 z-50 hidden md:block pointer-events-none"
        aria-label="Main"
      >
        <div className="pointer-events-auto border-b border-guinness-gold/10 bg-gradient-to-b from-guinness-brown/95 via-guinness-brown/90 to-guinness-brown/70 backdrop-blur-xl">
          <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center gap-4 px-4 lg:px-8">
            <NavLink
              to="/"
              prefetch={LINK_PREFETCH}
              viewTransition
              className="group shrink-0 text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-guinness-cream transition-colors hover:text-guinness-gold"
            >
              Split the G
            </NavLink>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
              <nav
                className="flex flex-wrap items-center justify-end gap-1 rounded-full border border-guinness-gold/15 bg-guinness-black/35 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                aria-label="Primary"
              >
                {primaryItems.map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    prefetch={LINK_PREFETCH}
                    viewTransition
                    className={({ isActive }) =>
                      `${deskPill} ${isActive ? deskActive : deskIdle}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
              <nav
                className="flex items-center gap-1 rounded-full border border-guinness-gold/10 bg-guinness-black/25 px-1.5 py-1"
                aria-label="More"
              >
                {secondaryItems.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    prefetch={LINK_PREFETCH}
                    viewTransition
                    className={({ isActive }) =>
                      `${deskPill} text-xs ${isActive ? deskActive : deskIdle}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile — floating dock + center Pour FAB */}
      <nav
        className="fixed bottom-3 left-3 right-3 z-50 md:hidden"
        aria-label="Main"
      >
        <div className="relative mx-auto w-full max-w-md min-w-0">
          <NavLink
            to="/"
            end
            title="Pour"
            prefetch={LINK_PREFETCH}
            viewTransition
            className={({ isActive }) =>
              [
                "absolute left-1/2 top-0 z-10 flex h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-[40%] flex-col items-center justify-center gap-0.5 rounded-full border-2 border-guinness-black/30 bg-guinness-gold text-[10px] font-bold uppercase leading-none tracking-wide text-guinness-black shadow-[0_8px_28px_rgba(0,0,0,0.45),0_0_0_1px_rgba(197,160,89,0.35)] transition-transform duration-200 active:scale-95",
                isActive
                  ? "ring-2 ring-guinness-gold/90 ring-offset-2 ring-offset-guinness-black"
                  : "hover:brightness-110",
              ].join(" ")
            }
          >
            <IconPint className="h-5 w-5" />
            <span className="mt-0.5">Pour</span>
          </NavLink>
          <div className="overflow-visible rounded-2xl border border-guinness-gold/25 bg-guinness-brown/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(197,160,89,0.08)] backdrop-blur-xl">
            <ul className="flex list-none items-stretch gap-0.5">
              <li className="flex min-w-0 flex-1 gap-0.5">
                {mobileDockItems.slice(0, 2).map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    prefetch={LINK_PREFETCH}
                    viewTransition
                    className={({ isActive }) =>
                      `${mobItem} flex-1 ${isActive ? mobActive : mobIdle}`
                    }
                  >
                    {dockIconFor(to)}
                    {label}
                  </NavLink>
                ))}
              </li>
              <li
                className="w-[4.5rem] shrink-0"
                aria-hidden="true"
              />
              <li className="flex min-w-0 flex-1 gap-0.5">
                {mobileDockItems.slice(2, 4).map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    prefetch={LINK_PREFETCH}
                    viewTransition
                    className={({ isActive }) =>
                      `${mobItem} flex-1 ${isActive ? mobActive : mobIdle}`
                    }
                  >
                    {dockIconFor(to)}
                    {label}
                  </NavLink>
                ))}
              </li>
            </ul>
            <div className="mt-1 flex w-full flex-row gap-0.5 border-t border-guinness-gold/10 pt-1.5">
              {mobileSecondaryItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  prefetch={LINK_PREFETCH}
                  viewTransition
                  title={
                    to === "/leaderboard" ? "Leaderboard" : to === "/faq" ? "FAQ" : "Wall"
                  }
                  aria-label={
                    to === "/leaderboard"
                      ? "Leaderboard"
                      : to === "/faq"
                        ? "FAQ"
                        : "Wall"
                  }
                  className={({ isActive }) =>
                    `flex min-h-[2.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[8px] font-semibold uppercase leading-tight tracking-wide transition-colors sm:px-1 sm:text-[9px] ${isActive ? "bg-guinness-gold/20 text-guinness-gold" : "text-guinness-tan/50 hover:text-guinness-tan"}`
                  }
                >
                  {secondaryDockIcon(to, "h-[1.125rem] w-[1.125rem] shrink-0")}
                  <span className="w-full text-center leading-none">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

/** @deprecated use AppNavigation */
export const MobileBottomNav = AppNavigation;
