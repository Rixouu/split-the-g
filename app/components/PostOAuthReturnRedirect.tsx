import { useEffect } from "react";
import { useLocation } from "react-router";
import { isOAuthReturnLandingPath } from "~/i18n/paths";
import { peekAndConsumePostOAuthReturnPath } from "~/utils/post-oauth-return";
import { useSupabaseAuthUser } from "~/utils/supabase-auth";

/**
 * After Google OAuth, Supabase often redirects only to the project Site URL (e.g. `/`),
 * because `/pour/...` is not in “Redirect URLs”. We store the intended path before
 * sign-in and send users there once a session exists.
 *
 * Uses a full document navigation (not SPA `navigate`) so production/Vercel does not
 * hit broken client-side loader/module requests for deep routes — same rationale as
 * `reloadDocument` on `AppShellNavLink` / `AppLink`.
 */
export function PostOAuthReturnRedirect() {
  const location = useLocation();
  const { user, authResolved } = useSupabaseAuthUser();

  useEffect(() => {
    if (!isOAuthReturnLandingPath(location.pathname)) return;
    if (!authResolved || !user) return;

    const here = `${location.pathname}${location.search}`;
    const target = peekAndConsumePostOAuthReturnPath(here);
    if (!target) return;
    window.location.replace(target);
  }, [authResolved, location.pathname, location.search, user]);

  return null;
}
