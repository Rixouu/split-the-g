import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";

/**
 * True when the signed-in user is in at least one competition whose end time has not passed
 * (upcoming or live). Used for the Compete nav indicator.
 */
export function useHasActiveCompetitionParticipation(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function sync() {
      const supabase = await getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) {
        if (!cancelled) setActive(false);
        return;
      }

      const { data: parts } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .eq("user_id", uid);

      const ids = [...new Set((parts ?? []).map((p) => p.competition_id as string))];
      if (ids.length === 0) {
        if (!cancelled) setActive(false);
        return;
      }

      const { data: comps } = await supabase
        .from("competitions")
        .select("id, ends_at")
        .in("id", ids);

      if (cancelled) return;
      const now = Date.now();
      const anyOpen = (comps ?? []).some(
        (c) => now <= new Date(String(c.ends_at)).getTime(),
      );
      setActive(anyOpen);
    }

    void sync();
    void getSupabaseBrowserClient().then((supabase) => {
      if (cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        void sync();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    const intervalId = window.setInterval(() => {
      void sync();
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.clearInterval(intervalId);
    };
  }, []);

  return active;
}
