import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { BrandedToast } from "./BrandedToast";
import { toastAutoCloseForVariant } from "./feedback-variant";

/**
 * Shows a branded success toast when the user completes sign-in (e.g. Google OAuth).
 * Uses `SIGNED_IN` only so restored sessions from `INITIAL_SESSION` do not toast on every load.
 */
export function GlobalAuthToast() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const onClose = useCallback(() => {
    setOpen(false);
    setText("");
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isDisposed = false;

    void getSupabaseBrowserClient().then((supabase) => {
      if (isDisposed) return;

      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setText("You're signed in. Welcome back.");
          setOpen(true);
        }
        if (event === "SIGNED_OUT") {
          onClose();
        }
      });

      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      isDisposed = true;
      unsubscribe?.();
    };
  }, [onClose]);

  return (
    <BrandedToast
      open={open}
      message={text}
      variant="success"
      title="Signed in"
      onClose={onClose}
      autoCloseMs={toastAutoCloseForVariant("success")}
    />
  );
}
