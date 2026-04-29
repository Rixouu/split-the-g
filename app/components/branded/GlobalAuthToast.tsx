import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { signInToastFromT } from "~/i18n/auth-copy";
import { useTChrome } from "~/i18n/context";
import { subscribeToSupabaseAuthChanges } from "~/utils/supabase-auth";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { BrandedToast } from "./BrandedToast";
import { toastAutoCloseForVariant } from "./feedback-variant";

async function resolvePreferredName(user: User): Promise<string> {
  const supabase = await getSupabaseBrowserClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("nickname, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = data as
    | { nickname?: string | null; display_name?: string | null }
    | null;

  const nick = row?.nickname?.trim();
  if (nick) return nick;

  const disp = row?.display_name?.trim();
  if (disp) return disp;

  const meta =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    (user.user_metadata?.name as string | undefined)?.trim();
  if (meta) return meta;

  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }

  return "Player";
}

/**
 * Branded success toast when sign-in completes (e.g. Google OAuth).
 * Uses `SIGNED_IN` only so restored sessions from `INITIAL_SESSION` do not toast on every load.
 */
export function GlobalAuthToast() {
  const t = useTChrome();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const onClose = useCallback(() => {
    setOpen(false);
    setTitle("");
    setText("");
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isDisposed = false;

    void subscribeToSupabaseAuthChanges((event, session) => {
      if (isDisposed) return;
      if (event === "SIGNED_IN" && session?.user) {
        void (async () => {
          let preferred = "there";
          try {
            preferred = await resolvePreferredName(session.user);
          } catch {
            preferred = "there";
          }
          if (isDisposed) return;
          const { title: nextTitle, message } = signInToastFromT(t, preferred);
          setTitle(nextTitle);
          setText(message);
          setOpen(true);
        })();
      }
      if (event === "SIGNED_OUT") {
        onClose();
      }
    }).then((nextUnsubscribe) => {
      if (isDisposed) {
        nextUnsubscribe();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });

    return () => {
      isDisposed = true;
      unsubscribe?.();
    };
  }, [onClose, t]);

  return (
    <BrandedToast
      open={open}
      message={text}
      variant="success"
      title={title || t("toasts.signedInFallback")}
      onClose={onClose}
      autoCloseMs={toastAutoCloseForVariant("success")}
    />
  );
}
