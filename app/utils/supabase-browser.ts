import type { SupabaseClient } from "@supabase/supabase-js";

let browserClientPromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseBrowserClient(): Promise<SupabaseClient> {
  if (typeof window === "undefined") {
    throw new Error("Supabase browser client requested on the server.");
  }

  if (!browserClientPromise) {
    browserClientPromise = import("@supabase/supabase-js").then(
      ({ createClient }) => {
        const supabaseUrl = window.ENV?.SUPABASE_URL || "";
        const supabaseAnonKey = window.ENV?.SUPABASE_ANON_KEY || "";

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error(
            "Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.",
          );
        }

        return createClient(supabaseUrl, supabaseAnonKey);
      },
    );
  }

  return browserClientPromise;
}
