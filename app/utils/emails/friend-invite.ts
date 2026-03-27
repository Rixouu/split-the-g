interface FriendInviteEmailProps {
  appUrl: string;
  inviteeEmail: string;
  inviterEmail: string;
  inviterName?: string | null;
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
}: FriendInviteEmailProps): FriendInviteEmailPayload {
  const baseUrl = appUrl.replace(/\/+$/, "");
  const inviterLabel = inviterName?.trim() || inviterEmail.trim();
  const inviteUrl = `${baseUrl}/profile`;
  const logoUrl = `${baseUrl}/logo-splittheg.svg`;
  const safeInviterLabel = escapeHtml(inviterLabel);
  const safeInviterEmail = escapeHtml(inviterEmail.trim());
  const safeInviteeEmail = escapeHtml(inviteeEmail.trim());
  const inviteeMailto = `mailto:${encodeURIComponent(inviteeEmail.trim())}`;
  const inviterMailto = `mailto:${encodeURIComponent(inviterEmail.trim())}`;
  const subject = `${inviterLabel} invited you to Split The G`;

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

  .cta-btn {
    display: inline-block;
    background-color: #c49a3c;
    color: #0f0e09;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: .03em;
    text-decoration: none;
    padding: 14px 32px;
    border-radius: 4px;
  }

  .meta-wrap {
    background-color: #14120c;
    border-left: 1px solid #2a2418;
    border-right: 1px solid #2a2418;
    padding: 28px 40px 32px;
  }

  .meta-line {
    font-size: 12.5px;
    color: #4a4438;
  }

  .meta-line a {
    color: #f5f0e8 !important;
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
    background-color: #0f0e09;
    border: 1px solid #2a2418;
    border-top: none;
    border-radius: 0 0 4px 4px;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .footer-brand {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .06em;
    color: #3a3428;
    text-transform: uppercase;
  }

  .footer-tagline {
    font-size: 12px;
    color: #3a3428;
    letter-spacing: .01em;
    text-align: right;
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

    .header,
    .footer {
      display: block !important;
    }

    .footer-tagline {
      margin-top: 14px;
      display: inline-block;
    }

    .hero-heading {
      font-size: 34px !important;
      line-height: 1.08 !important;
    }

    .footer-tagline {
      text-align: left;
    }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">
      <img src="${logoUrl}" alt="Split The G" />
    </div>
  </div>

  <div class="rule"></div>

  <div class="hero">
    <p class="hero-eyebrow">You've been invited</p>
    <h1 class="hero-heading">${safeInviterLabel}<br>wants you on<br>the <span>board.</span></h1>
    <p class="hero-body">
      You've been invited to join <strong>Split The G</strong>. Chase the perfect pour, climb the live leaderboard, and stir up a little friendly rivalry with your mates.
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
    <a href="${inviteUrl}" class="cta-btn">Open Split The G</a>
  </div>

  <div class="meta-wrap">
    <div style="height:20px;"></div>
    <p class="meta-line">
      Invited by ${safeInviterLabel}
      <span class="meta-dot"></span>
      <a href="${inviterMailto}">${safeInviterEmail}</a>
    </p>
  </div>

  <div class="rule"></div>

  <div class="footer">
    <span class="footer-brand">Split The G</span>
    <span class="footer-tagline">Simple pours, live boards, good friends.</span>
  </div>
</div>
</body>
</html>`;

  const text = [
    `${inviterLabel} invited you to Split The G.`,
    "",
    `Sign in with ${inviteeEmail.trim()} to see the invite in the app.`,
    `Open: ${inviteUrl}`,
    "",
    `Invited by: ${inviterLabel} (${inviterEmail.trim()})`,
  ].join("\n");

  return { subject, html, text };
}
