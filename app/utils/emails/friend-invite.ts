interface FriendInviteEmailProps {
  appUrl: string;
  inviteeEmail: string;
  inviterEmail: string;
  inviterName?: string | null;
  /** Primary button target, e.g. `/competitions/uuid` or `/profile`. */
  invitePath?: string;
  /** When set, subject/body mention this competition. */
  competitionTitle?: string | null;
  /** Full URL to logo image (e.g. CDN). Defaults to `{appUrl}/logo-splittheg.png`. */
  logoUrlOverride?: string | null;
}

interface FriendInviteEmailPayload {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildFriendInviteEmail({
  appUrl,
  inviteeEmail,
  inviterEmail,
  inviterName,
  invitePath,
  competitionTitle,
  logoUrlOverride,
}: FriendInviteEmailProps): FriendInviteEmailPayload {
  const baseUrl = appUrl.replace(/\/+$/, "");
  const inviterLabel = inviterName?.trim() || inviterEmail.trim();
  const rawInvitePath = invitePath?.trim();
  const path =
    !rawInvitePath || rawInvitePath === ""
      ? "/profile"
      : rawInvitePath.startsWith("/")
        ? rawInvitePath
        : `/${rawInvitePath}`;
  const inviteUrl = `${baseUrl}${path}`;
  const logoFromOverride = logoUrlOverride?.trim();
  const logoUrl = logoFromOverride
    ? logoFromOverride
    : `${baseUrl}/logo-splittheg.png`;
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeInviterLabel = escapeHtml(inviterLabel);
  const safeInviterEmail = escapeHtml(inviterEmail.trim());
  const safeInviteeEmail = escapeHtml(inviteeEmail.trim());
  const inviteeMailto = `mailto:${encodeURIComponent(inviteeEmail.trim())}`;
  const inviterMailto = `mailto:${encodeURIComponent(inviterEmail.trim())}`;
  const compTitle = competitionTitle?.trim();
  const safeCompTitle = compTitle ? escapeHtml(compTitle) : "";
  const subject = compTitle
    ? `${inviterLabel} invited you to “${compTitle}” on Split The G`
    : `${inviterLabel} invited you to Split The G`;
  const ctaLabel = compTitle ? "View competition" : "Open Split The G";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background-color: #0a0a09;
    font-family: 'DM Sans', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 40px 16px;
  }

  .wrapper {
    max-width: 580px;
    margin: 0 auto;
  }

  .header {
    background-color: #14120c;
    border: 1px solid #2a2418;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    padding: 28px 40px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .logo img {
    height: 34px;
    width: auto;
    display: block;
    margin: 0 auto;
  }

  .rule {
    height: 1px;
    background: linear-gradient(90deg, #2a2418 0%, #3d3120 40%, #2a2418 100%);
    margin: 0;
  }

  .hero {
    background-color: #14120c;
    border-left: 1px solid #2a2418;
    border-right: 1px solid #2a2418;
    padding: 48px 40px 40px;
  }

  .hero-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #c49a3c;
    margin-bottom: 16px;
  }

  .hero-heading {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 42px;
    font-weight: 800;
    line-height: 1.08;
    color: #f5f0e8;
    letter-spacing: -.02em;
    margin-bottom: 20px;
  }

  .hero-heading span {
    color: #c49a3c;
  }

  .hero-body {
    font-size: 15px;
    font-weight: 400;
    line-height: 1.65;
    color: #8a8070;
    max-width: 440px;
  }

  .hero-body strong {
    color: #d4c9b0;
    font-weight: 500;
  }

  .card-wrap {
    background-color: #14120c;
    border-left: 1px solid #2a2418;
    border-right: 1px solid #2a2418;
    padding: 0 40px 8px;
  }

  .info-card {
    background-color: #0f0e09;
    border: 1px solid #2a2418;
    border-radius: 4px;
    padding: 24px 28px;
  }

  .info-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .13em;
    text-transform: uppercase;
    color: #c49a3c;
    margin-bottom: 10px;
  }

  .info-email {
    font-size: 15px;
    font-weight: 500;
    color: #f5f0e8 !important;
    text-decoration: none;
    display: block;
    margin-bottom: 10px;
  }

  .info-note {
    font-size: 13px;
    color: #5a5346;
    line-height: 1.55;
  }

  .cta-wrap {
    background-color: #14120c;
    border-left: 1px solid #2a2418;
    border-right: 1px solid #2a2418;
    padding: 32px 40px 0;
    text-align: center;
  }

  /* Fallback; primary CTA uses table + inline styles for Gmail/Outlook. */
  .cta-btn {
    display: inline-block;
    background-color: #c49a3c;
    color: #0f0e09 !important;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: .03em;
    text-decoration: none !important;
    padding: 14px 32px;
    border-radius: 4px;
    -webkit-text-fill-color: #0f0e09;
  }

  .meta-wrap {
    background-color: #14120c;
    border-left: 1px solid #2a2418;
    border-right: 1px solid #2a2418;
    padding: 28px 40px 32px;
    text-align: center;
  }

  .meta-line {
    font-size: 13px;
    line-height: 1.6;
    color: #8a8070;
    text-align: center;
  }

  .meta-line a {
    color: #d4c9b0 !important;
    text-decoration: none;
  }

  .meta-dot {
    display: inline-block;
    width: 3px;
    height: 3px;
    background-color: #c49a3c;
    border-radius: 50%;
    vertical-align: middle;
    margin: 0 8px;
    position: relative;
    top: -1px;
  }

  .footer {
    background-color: #14120c;
    border: 1px solid #2a2418;
    border-top: none;
    border-radius: 0 0 4px 4px;
    padding: 24px 40px 28px;
    text-align: center;
  }

  .footer-brand {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: .1em;
    color: #b8a88c;
    text-transform: uppercase;
    margin: 0 0 12px 0;
  }

  .footer-tagline {
    font-size: 13px;
    line-height: 1.55;
    color: #9a907c;
    letter-spacing: .01em;
    margin: 0;
  }

  @media only screen and (max-width: 640px) {
    body {
      padding: 24px 12px;
    }

    .header,
    .hero,
    .card-wrap,
    .cta-wrap,
    .meta-wrap,
    .footer {
      padding-left: 22px !important;
      padding-right: 22px !important;
    }

    .hero-heading {
      font-size: 34px !important;
      line-height: 1.08 !important;
    }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">
      <img src="${safeLogoUrl}" alt="Split The G" width="200" height="34" style="display:block;height:34px;width:auto;max-width:220px;margin:0 auto;border:0;outline:none;text-decoration:none;color:#e8e4dc;" />
    </div>
  </div>

  <div class="rule"></div>

  <div class="hero">
    <p class="hero-eyebrow">You've been invited</p>
    <h1 class="hero-heading">${safeInviterLabel}<br>wants you on<br>the <span>board.</span></h1>
    <p class="hero-body">
      ${
        compTitle
          ? `You&apos;re invited to <strong>${safeCompTitle}</strong> on Split The G. `
          : `You&apos;ve been invited to join <strong>Split The G</strong>. `
      }Chase the perfect pour, climb the live leaderboard, and stir up a little friendly rivalry with your mates.
    </p>
  </div>

  <div class="card-wrap">
    <div style="height:24px;"></div>
    <div class="info-card">
      <p class="info-label">Sign in with this email</p>
      <a href="${inviteeMailto}" class="info-email">${safeInviteeEmail}</a>
      <p class="info-note">The app will show the invite automatically when you sign in with the same address.</p>
    </div>
    <div style="height:8px;"></div>
  </div>

  <div class="cta-wrap">
    <div style="height:8px;"></div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;">
      <tr>
        <td align="center" bgcolor="#c49a3c" style="background-color:#c49a3c;border-radius:4px;mso-padding-alt:14px 32px;">
          <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.25;letter-spacing:0.03em;color:#0f0e09 !important;-webkit-text-fill-color:#0f0e09;text-decoration:none !important;border-radius:4px;">
            <span style="color:#0f0e09 !important;-webkit-text-fill-color:#0f0e09;text-decoration:none !important;">${escapeHtml(ctaLabel)}</span>
          </a>
        </td>
      </tr>
    </table>
  </div>

  <div class="meta-wrap">
    <div style="height:20px;"></div>
    <p class="meta-line">
      Invited by ${safeInviterLabel}
      <span class="meta-dot" aria-hidden="true"></span>
      <a href="${inviterMailto}">${safeInviterEmail}</a>
    </p>
  </div>

  <div class="rule"></div>

  <div class="footer">
    <p class="footer-brand">Split The G</p>
    <p class="footer-tagline">Simple pours, live boards, good friends.</p>
  </div>
</div>
</body>
</html>`;

  const text = [
    subject,
    "",
    compTitle ? `Competition: ${compTitle}` : null,
    `Sign in with ${inviteeEmail.trim()} to see the invite in the app.`,
    `Open: ${inviteUrl}`,
    "",
    `Invited by: ${inviterLabel} (${inviterEmail.trim()})`,
  ]
    .filter((line): line is string => line != null && line !== "")
    .join("\n");

  return { subject, html, text };
}
