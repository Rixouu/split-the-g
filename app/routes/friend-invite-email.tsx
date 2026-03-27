import type { ActionFunctionArgs } from "react-router";

import { buildFriendInviteEmail } from "~/utils/emails/friend-invite";

interface FriendInviteRequestBody {
  inviterEmail?: string;
  inviterName?: string | null;
  toEmail?: string;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toAbsoluteAppUrl(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405 });

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return Response.json(
      { error: "Missing RESEND_API_KEY on the server." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as FriendInviteRequestBody;
    const inviterEmail = body.inviterEmail?.trim() ?? "";
    const toEmail = body.toEmail?.trim().toLowerCase() ?? "";
    const inviterName = body.inviterName?.trim() || null;

    if (!isValidEmail(inviterEmail) || !isValidEmail(toEmail)) {
      return Response.json(
        { error: "Valid inviter and recipient emails are required." },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const appUrl = toAbsoluteAppUrl(
      process.env.APP_URL ||
        process.env.PUBLIC_APP_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      url.origin,
    );

    const { subject, html, text } = buildFriendInviteEmail({
      appUrl,
      inviteeEmail: toEmail,
      inviterEmail,
      inviterName,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Split The G <onboarding@split-the-g.app>",
        to: [toEmail],
        subject,
        html,
        text,
        reply_to: inviterEmail,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return Response.json(
        {
          error: "Resend rejected the invite email.",
          details: errorText,
        },
        { status: 502 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to send invite email.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
