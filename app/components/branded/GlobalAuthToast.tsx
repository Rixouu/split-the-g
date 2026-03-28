import { useCallback, useEffect, useState } from "react";
import { supabase } from "~/utils/supabase";
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setText("You're signed in. Welcome back.");
        setOpen(true);
      }
      if (event === "SIGNED_OUT") {
        onClose();
      }
    });
    return () => sub.subscription.unsubscribe();
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
