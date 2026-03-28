import { NavLink, useLocation } from "react-router";
import { useHasActiveCompetitionParticipation } from "~/components/competition/hooks/useCompeteParticipation";

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

const NAV_ICON_DIR = "/icons/nav";

type MobileNavIconName =
  | "feed"
  | "compete"
  | "pubs"
  | "profile"
  | "pour"
  | "wall"
  | "rank"
  | "faq";

/**
 * Raster SVGs from /public/icons/nav — masked with `currentColor` so active/idle
 * dock text colors still apply (same behavior as the previous inline SVGs).
 */
function MobileNavIcon({
  name,
  className = "",
}: {
  name: MobileNavIconName;
  className?: string;
}) {
  const src = `${NAV_ICON_DIR}/${name}.svg`;
  return (
    <span
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      aria-hidden
    />
  );
}

function secondaryDockIcon(to: string, className: string) {
  switch (to) {
    case "/wall":
      return <MobileNavIcon name="wall" className={className} />;
    case "/leaderboard":
      return <MobileNavIcon name="rank" className={className} />;
    case "/faq":
      return <MobileNavIcon name="faq" className={className} />;
    default:
      return null;
  }
}

const dockIconClass = "h-[1.5rem] w-[1.5rem]";

function dockIconFor(to: string) {
  switch (to) {
    case "/feed":
      return <MobileNavIcon name="feed" className={dockIconClass} />;
    case "/competitions":
      return <MobileNavIcon name="compete" className={dockIconClass} />;
    case "/pubs":
      return <MobileNavIcon name="pubs" className={dockIconClass} />;
    case "/profile":
      return <MobileNavIcon name="profile" className={dockIconClass} />;
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

/** Live competition indicator — corner badge so label text stays readable. */
function CompetitionLiveBadge({
  size,
  className = "",
}: {
  size: "dock" | "desktop";
  className?: string;
}) {
  const dim = size === "desktop" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span
      className={`pointer-events-none absolute z-[2] rounded-full border-2 border-[#322914] bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.5)] ${dim} ${className}`}
      title="You're in an active competition"
      aria-hidden
    />
  );
}

const mobItem =
  "relative flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-visible rounded-xl px-0.5 py-1 text-[9px] font-bold uppercase leading-tight tracking-wide outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-guinness-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-guinness-black sm:text-[10px]";
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
    pathname.startsWith("/profile/") ||
    pathname === "/pubs" ||
    pathname.startsWith("/pubs/") ||
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
  const hasCompeteParticipation = useHasActiveCompetitionParticipation();

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
                className="flex flex-wrap items-center justify-end gap-1 overflow-visible rounded-full border border-guinness-gold/15 bg-guinness-black/35 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                aria-label="Primary"
              >
                {primaryItems.map(({ to, label, end }) => {
                  const isCompete = to === "/competitions";
                  const showCompeteDot = isCompete && hasCompeteParticipation;
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      prefetch={LINK_PREFETCH}
                      viewTransition
                      aria-label={
                        showCompeteDot
                          ? `${label} — you’re in an active competition`
                          : undefined
                      }
                      className={({ isActive }) =>
                        `${deskPill} ${isActive ? deskActive : deskIdle} ${showCompeteDot ? "relative overflow-visible" : ""}`
                      }
                    >
                      {showCompeteDot ? (
                        <CompetitionLiveBadge
                          size="desktop"
                          className="-right-0.5 -top-1.5 translate-x-1/4 -translate-y-0"
                        />
                      ) : null}
                      {label}
                    </NavLink>
                  );
                })}
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
            <MobileNavIcon name="pour" className="h-7 w-7" />
            <span className="mt-0.5">Pour</span>
          </NavLink>
          <div className="overflow-visible rounded-2xl border border-guinness-gold/25 bg-guinness-brown/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(197,160,89,0.08)] backdrop-blur-xl">
            <ul className="flex list-none items-stretch gap-0.5">
              <li className="flex min-w-0 flex-1 gap-0.5">
                {mobileDockItems.slice(0, 2).map(({ to, label }) => {
                  const showCompeteDot = to === "/competitions" && hasCompeteParticipation;
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      prefetch={LINK_PREFETCH}
                      viewTransition
                      aria-label={
                        showCompeteDot
                          ? `${label} — you’re in an active competition`
                          : undefined
                      }
                      className={({ isActive }) =>
                        `${mobItem} flex-1 ${isActive ? mobActive : mobIdle}`
                      }
                    >
                      {showCompeteDot ? (
                        <CompetitionLiveBadge
                          size="dock"
                          className="right-1 top-0.5 -translate-y-px"
                        />
                      ) : null}
                      {dockIconFor(to)}
                      {label}
                    </NavLink>
                  );
                })}
              </li>
              <li
                className="w-[4.5rem] shrink-0"
                aria-hidden="true"
              />
              <li className="flex min-w-0 flex-1 gap-0.5">
                {mobileDockItems.slice(2, 4).map(({ to, label }) => {
                  const showCompeteDot = to === "/competitions" && hasCompeteParticipation;
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      prefetch={LINK_PREFETCH}
                      viewTransition
                      aria-label={
                        showCompeteDot
                          ? `${label} — you’re in an active competition`
                          : undefined
                      }
                      className={({ isActive }) =>
                        `${mobItem} flex-1 ${isActive ? mobActive : mobIdle}`
                      }
                    >
                      {showCompeteDot ? (
                        <CompetitionLiveBadge
                          size="dock"
                          className="right-1 top-0.5 -translate-y-px"
                        />
                      ) : null}
                      {dockIconFor(to)}
                      {label}
                    </NavLink>
                  );
                })}
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
