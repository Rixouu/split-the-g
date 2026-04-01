import type { ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LOCALE, isSupportedLocale } from "~/i18n/config";

interface PushSubscriptionPayload {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  locale?: string;
}

async function getAuthUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const url = process.env.VITE_SUPABASE_URL || "";
  const anon = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!token || !url || !anon) return null;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await supabase.auth.getUser(token);
  return data.user ?? null;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST" && request.method !== "DELETE")
    return Response.json({ error: "Method not allowed" }, { status: 405 });

  const user = await getAuthUser(request);
  if (!user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.VITE_SUPABASE_URL || "";
  if (!serviceRole || !url)
    return Response.json({ error: "Missing server Supabase config." }, { status: 500 });

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  if (request.method === "DELETE") {
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    const endpoint = body.endpoint?.trim();
    if (!endpoint)
      return Response.json({ error: "Missing endpoint." }, { status: 400 });

    await supabase
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    return Response.json({ success: true });
  }

  const body = (await request.json()) as PushSubscriptionPayload;
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  const localeRaw = body.locale?.trim().toLowerCase() ?? DEFAULT_LOCALE;
  const locale = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;

  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: "Invalid push subscription payload." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      user_email: user.email?.trim().toLowerCase() ?? null,
      endpoint,
      p256dh,
      auth,
      locale,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
