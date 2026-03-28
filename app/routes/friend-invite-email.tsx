import type { ActionFunctionArgs } from "react-router";

import { buildFriendInviteEmail } from "~/utils/emails/friend-invite";

interface FriendInviteRequestBody {
  inviterEmail?: string;
  inviterName?: string | null;
  toEmail?: string;
  /** e.g. `/competitions/<uuid>` — defaults to `/profile` */
  invitePath?: string;
  competitionTitle?: string | null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Trim trailing slashes; add https:// when the value is host-only. */
function normalizePublicSiteUrl(raw: string): string {
  const v = raw.trim().replace(/\/+$/, "");
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function hostnameIsLocal(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    /^192\.168\./.test(h) ||
    h.endsWith(".local")
  );
}

/** Gmail and other clients fetch image URLs from their servers — only https + non-local works. */
function isPublicHttpsEmailBase(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.protocol === "https:" && !hostnameIsLocal(u.hostname);
  } catch {
    return false;
  }
}

function trimTrailingSlashes(urlStr: string): string {
  return urlStr.replace(/\/+$/, "");
}

/**
 * Inbox clients cannot load assets from localhost or plain HTTP.
 * Do not re-read APP_URL here: it may be the same unusable candidate (e.g. http://localhost:5173).
 */
function ensureReachableUrlsForEmail(candidate: string): string {
  if (isPublicHttpsEmailBase(candidate)) return trimTrailingSlashes(candidate);

  const emailPublic = normalizePublicSiteUrl(
    process.env.EMAIL_PUBLIC_SITE_URL || "",
  );
  if (emailPublic && isPublicHttpsEmailBase(emailPublic))
    return trimTrailingSlashes(emailPublic);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) {
    const v = normalizePublicSiteUrl(vercelProd);
    if (isPublicHttpsEmailBase(v)) return trimTrailingSlashes(v);
  }

  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    const v = normalizePublicSiteUrl(`https://${vercel}`);
    if (isPublicHttpsEmailBase(v)) return trimTrailingSlashes(v);
  }

  return "https://www.split-the-g.app";
}

/**
 * Base URL for links and logo in outbound email.
 * Prefer explicit APP_URL when set; otherwise use the request origin when it is
 * a public https URL (matches the tab the user sent from, e.g. www.split-the-g.app).
 * Avoid defaulting to VERCEL_URL first — it can differ from the custom domain and
 * break image hotlinking in some setups.
 */
function resolvePublicAppUrl(requestOrigin: string): string {
  const explicit = normalizePublicSiteUrl(
    process.env.APP_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.VITE_PUBLIC_APP_URL ||
      "",
  );
  if (explicit) return ensureReachableUrlsForEmail(explicit);

  const origin = requestOrigin.replace(/\/+$/, "");
  const isLocal =
    /localhost/i.test(origin) ||
    /127\.0\.0\.1/.test(origin) ||
    /192\.168\./.test(origin) ||
    /\[::1\]/.test(origin);

  if (!isLocal && /^https:\/\//i.test(origin)) {
    return ensureReachableUrlsForEmail(origin);
  }

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd)
    return ensureReachableUrlsForEmail(normalizePublicSiteUrl(vercelProd));

  const vercel = process.env.VERCEL_URL;
  if (vercel)
    return ensureReachableUrlsForEmail(normalizePublicSiteUrl(`https://${vercel}`));

  const fallback = /^https?:\/\//i.test(origin) ? origin : `https://${origin}`;
  return ensureReachableUrlsForEmail(fallback);
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
    const invitePath = body.invitePath?.trim() || undefined;
    const competitionTitle = body.competitionTitle?.trim() || null;

    if (!isValidEmail(inviterEmail) || !isValidEmail(toEmail)) {
      return Response.json(
        { error: "Valid inviter and recipient emails are required." },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const appUrl = resolvePublicAppUrl(url.origin);

    const { subject, html, text } = buildFriendInviteEmail({
      appUrl,
      inviteeEmail: toEmail,
      inviterEmail,
      inviterName,
      invitePath,
      competitionTitle,
      logoUrlOverride: process.env.EMAIL_LOGO_URL?.trim() || null,
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
