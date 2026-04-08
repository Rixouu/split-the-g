import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function getEnvSupabaseUrlAndAnon(): { url: string; anon: string } {
  const url =
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
    import.meta.env.VITE_SUPABASE_URL ||
    "";
  const anon =
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "";
  return { url, anon };
}

/**
 * Validates a Supabase access token and returns the user, or null if invalid.
 */
export async function getSupabaseUserFromAccessToken(
  accessToken: string,
): Promise<User | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const { url, anon } = getEnvSupabaseUrlAndAnon();
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...v] = c.split("=");
      return [key.trim(), v.join("=")];
    }).filter(([k]) => k),
  );
}

/**
 * Best-effort: some setups persist the session in `sb-<ref>-auth-token` (JSON with access_token).
 */
export function getSupabaseAccessTokenFromRequestCookies(
  request: Request,
): string | null {
  return getSupabaseAccessTokenFromCookieHeader(
    request.headers.get("Cookie") ?? "",
  );
}

export function getSupabaseAccessTokenFromCookieHeader(
  cookieHeader: string,
): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  for (const [name, value] of Object.entries(cookies)) {
    if (!/^sb-[a-z0-9]+-auth-token$/i.test(name)) continue;
    for (const raw of [decodeURIComponent(value), value]) {
      try {
        const parsed = JSON.parse(raw) as { access_token?: string };
        if (
          typeof parsed.access_token === "string" &&
          parsed.access_token.length > 0
        ) {
          return parsed.access_token;
        }
      } catch {
        // try next decode / cookie
      }
    }
  }
  return null;
}

/** Same naming rules as client `handleClaimWithGoogle` (profile nickname → metadata → email local). */
export async function resolveLeaderboardUsernameForAuthUser(
  user: User,
  supabase: SupabaseClient,
): Promise<string> {
  const { data: profile } = await supabase
    .from("public_profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  const nick =
    typeof profile?.nickname === "string" ? profile.nickname.trim() : "";

  const rawMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const googleFullName =
    (typeof rawMeta.full_name === "string" && rawMeta.full_name.trim()) ||
    (typeof rawMeta.name === "string" && rawMeta.name.trim()) ||
    (typeof rawMeta.given_name === "string" && rawMeta.given_name.trim()) ||
    (user.email?.split("@")[0] ?? "Drinker");

  return nick || googleFullName;
}
