import { useEffect } from "react";
import { useLocation } from "react-router";
import { isOAuthReturnLandingPath } from "~/i18n/paths";
import { peekAndConsumePostOAuthReturnPath } from "~/utils/post-oauth-return";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";

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

  useEffect(() => {
    if (!isOAuthReturnLandingPath(location.pathname)) return;

    const here = `${location.pathname}${location.search}`;
    let unsubscribe: (() => void) | null = null;
    let isDisposed = false;

    async function tryRestore() {
      const supabase = await getSupabaseBrowserClient();
      await supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        const target = peekAndConsumePostOAuthReturnPath(here);
        if (!target) return;
        window.location.replace(target);
      });
    }

    void tryRestore();

    void getSupabaseBrowserClient().then((supabase) => {
      if (isDisposed) return;

      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          void tryRestore();
        }
      });

      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      isDisposed = true;
      unsubscribe?.();
    };
  }, [location.pathname, location.search, navigate]);

  return null;
}
