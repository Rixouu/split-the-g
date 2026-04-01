import type { ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { sendPushByUserEmail } from "~/utils/push-notifications.server";

interface NotifyBody {
  type?: "friend_request_received" | "competition_invite_received";
  toEmail?: string;
  actorName?: string | null;
  competitionTitle?: string | null;
  path?: string | null;
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
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405 });

  const user = await getAuthUser(request);
  if (!user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as NotifyBody;
  const toEmail = body.toEmail?.trim().toLowerCase() ?? "";
  if (!toEmail || !body.type) {
    return Response.json({ error: "Missing target or type." }, { status: 400 });
  }

  const report = await sendPushByUserEmail(toEmail, {
    type: body.type,
    actorName: body.actorName ?? null,
    competitionTitle: body.competitionTitle ?? null,
    path: body.path ?? "/",
  });

  return Response.json({ success: report.sent > 0, report });
}
