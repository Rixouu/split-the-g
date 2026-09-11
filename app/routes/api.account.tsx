import { createClient } from "@supabase/supabase-js";
import type { ActionFunctionArgs } from "react-router";
import { getSupabaseUserFromAccessToken } from "~/utils/pour-auth-claim.server";

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getSupabaseUserFromAccessToken(bearerToken(request));
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.VITE_SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRole) {
    return Response.json({ error: "Account deletion is temporarily unavailable." }, { status: 503 });
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deleteOwned = async (table: string, column: string, value: string) => {
    const { error } = await admin.from(table).delete().eq(column, value);
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  try {
    // Scores predate authenticated submissions, so clean both the user-id and
    // legacy email links before removing the auth record. Related rows cascade.
    await deleteOwned("scores", "submitter_user_id", user.id);
    if (user.email) {
      await deleteOwned("scores", "email", user.email);
      await deleteOwned("friend_requests", "to_email", user.email);
      await deleteOwned("competition_invites", "invited_email", user.email);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (error) {
    console.error("Account deletion failed", error);
    return Response.json(
      { error: "Could not delete your account. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
