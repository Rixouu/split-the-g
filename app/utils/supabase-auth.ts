import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";

export type SupabaseAuthUserSnapshot = {
  user: User | null;
  userId: string | null;
  userEmail: string | null;
};

const EMPTY_AUTH_SNAPSHOT: SupabaseAuthUserSnapshot = {
  user: null,
  userId: null,
  userEmail: null,
};

function normalizeAuthEmail(user: User | null): string | null {
  const email = user?.email?.trim().toLowerCase() ?? "";
  return email || null;
}

export function toSupabaseAuthUserSnapshot(
  user: User | null,
): SupabaseAuthUserSnapshot {
  return {
    user,
    userId: user?.id ?? null,
    userEmail: normalizeAuthEmail(user),
  };
}

export async function getSupabaseAuthUserSnapshot(): Promise<SupabaseAuthUserSnapshot> {
  const supabase = await getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  return toSupabaseAuthUserSnapshot(data.user ?? null);
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = await getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function subscribeToSupabaseAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): Promise<() => void> {
  const supabase = await getSupabaseBrowserClient();
  const { data: sub } = supabase.auth.onAuthStateChange(callback);
  return () => sub.subscription.unsubscribe();
}

export function useSupabaseAuthUser() {
  const [snapshot, setSnapshot] = useState<SupabaseAuthUserSnapshot>(
    EMPTY_AUTH_SNAPSHOT,
  );
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function syncSnapshot() {
      try {
        const nextSnapshot = await getSupabaseAuthUserSnapshot();
        if (cancelled) return;
        setSnapshot(nextSnapshot);
      } catch {
        if (cancelled) return;
        setSnapshot(EMPTY_AUTH_SNAPSHOT);
      } finally {
        if (!cancelled) setAuthResolved(true);
      }
    }

    void syncSnapshot();

    void subscribeToSupabaseAuthChanges((_event, session) => {
      if (cancelled) return;
      setSnapshot(toSupabaseAuthUserSnapshot(session?.user ?? null));
      setAuthResolved(true);
    })
      .then((nextUnsubscribe) => {
        if (cancelled) {
          nextUnsubscribe();
          return;
        }
        unsubscribe = nextUnsubscribe;
      })
      .catch(() => {
        if (!cancelled) setAuthResolved(true);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return {
    ...snapshot,
    authResolved,
  };
}
