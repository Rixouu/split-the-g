import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { peekAndConsumePostOAuthReturnPath } from "~/utils/post-oauth-return";
import { supabase } from "~/utils/supabase";

/**
 * After Google OAuth, Supabase often redirects only to the project Site URL (e.g. `/`),
 * because `/pour/...` is not in “Redirect URLs”. We store the intended path before
 * sign-in and send users there once a session exists.
 */
export function PostOAuthReturnRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/") return;

    const here = `${location.pathname}${location.search}`;

    function tryRestore() {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        const target = peekAndConsumePostOAuthReturnPath(here);
        if (!target) return;
        navigate(target, { replace: true, viewTransition: true });
      });
    }

    tryRestore();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") tryRestore();
    });

    return () => sub.subscription.unsubscribe();
  }, [location.pathname, location.search, navigate]);

  return null;
}
