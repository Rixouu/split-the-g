/**
 * Reusable opt-in for React Router navigations that should use the same
 * View Transitions animation as `app/styles/view-transitions.css` (main surface
 * fade/slide; fixed nav held static).
 *
 * - Spread on `<Link viewTransition>` is redundant; use this when composing props.
 * - Pass to `useNavigate`: `navigate(to, { viewTransition: true })`.
 */
export const routeViewTransitionLinkProps = {
  viewTransition: true as const,
};

export type RouteViewTransitionLinkProps = typeof routeViewTransitionLinkProps;
