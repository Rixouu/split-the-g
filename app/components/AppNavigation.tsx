import { NavLink, useLocation } from "react-router";

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

/** Mobile dock second row — Wall + Leaderboard (no FAQ in dock) */
const mobileSecondaryItems: { to: string; label: string }[] = [
  { to: "/wall", label: "Wall" },
  { to: "/leaderboard", label: "Leaderboard" },
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

function IconWall({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconLeaderboard({ className }: { className?: string }) {
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
      <path d="M12 15v6M8 21h8M6 10h12M4 10V6a2 2 0 0 1 2-2h2v6H4zm0 0h4m8 0h4m0 0V6a2 2 0 0 0-2-2h-2v6h4" />
    </svg>
  );
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
  "relative flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[9px] font-bold uppercase leading-tight tracking-wide transition-all duration-200 sm:text-[10px]";
const mobActive =
  "text-guinness-gold bg-guinness-gold/[0.08] shadow-inner";
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
        <div className="relative mx-auto max-w-md">
          <NavLink
            to="/"
            end
            title="Pour"
            className={({ isActive }) =>
              [
                "absolute left-1/2 top-0 z-10 flex h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-[40%] flex-col items-center justify-center gap-0.5 rounded-full border-2 border-guinness-black/30 bg-guinness-gold text-[10px] font-bold uppercase leading-none tracking-wide text-guinness-black shadow-[0_8px_28px_rgba(0,0,0,0.45),0_0_0_1px_rgba(197,160,89,0.35)] transition-transform duration-200 active:scale-95",
                isActive
                  ? "ring-2 ring-guinness-gold ring-offset-2 ring-offset-guinness-brown"
                  : "hover:brightness-110",
              ].join(" ")
            }
          >
            <IconPint className="h-5 w-5" />
            <span className="mt-0.5">Pour</span>
          </NavLink>
          <div className="rounded-2xl border border-guinness-gold/25 bg-guinness-brown/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <ul className="flex list-none items-stretch gap-0.5">
              <li className="flex min-w-0 flex-1 gap-0.5">
                {mobileDockItems.slice(0, 2).map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
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
            <div className="mt-1 flex items-center justify-center gap-3 border-t border-guinness-gold/10 pt-1.5">
              {mobileSecondaryItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1 rounded-full px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors sm:text-[10px] ${isActive ? "bg-guinness-gold/20 text-guinness-gold" : "text-guinness-tan/50 hover:text-guinness-tan"}`
                  }
                >
                  {to === "/wall" ? (
                    <IconWall className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <IconLeaderboard className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {label}
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
