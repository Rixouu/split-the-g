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
  const subject = `${inviterLabel} invited you to Split The G`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(subject)}</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap");
      body {
        margin: 0;
        padding: 0;
        background: #050608;
        color: #f5efe6;
        font-family: "Google Sans", Arial, sans-serif;
      }
      a {
        color: inherit;
      }
      @media only screen and (max-width: 640px) {
        .shell {
          padding: 24px 14px !important;
        }
        .card {
          border-radius: 22px !important;
        }
        .card-pad {
          padding: 28px 22px !important;
        }
        .display {
          font-size: 30px !important;
          line-height: 36px !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell" style="padding: 36px 18px; background: #050608;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              style="max-width: 620px;"
            >
              <tr>
                <td
                  class="card"
                  style="border: 1px solid rgba(197,160,89,0.28); border-radius: 28px; background: linear-gradient(180deg, #15120c 0%, #0e0d0a 100%); overflow: hidden;"
                >
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td
                        class="card-pad"
                        style="padding: 34px 34px 18px; text-align: center; border-bottom: 1px solid rgba(197,160,89,0.12);"
                      >
                        <img
                          src="${logoUrl}"
                          alt="Split The G"
                          width="220"
                          style="display: block; width: 220px; max-width: 72%; height: auto; margin: 0 auto 18px;"
                        />
                        <div
                          style="display: inline-block; padding: 7px 12px; border-radius: 999px; background: rgba(197,160,89,0.12); color: #c5a059; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;"
                        >
                          Friend Invite
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="card-pad" style="padding: 34px;">
                        <div
                          class="display"
                          style="font-size: 36px; line-height: 42px; font-weight: 700; letter-spacing: -0.03em; color: #f5efe6;"
                        >
                          ${safeInviterLabel} wants you on the board.
                        </div>
                        <p style="margin: 18px 0 0; font-size: 17px; line-height: 28px; color: rgba(245,239,230,0.8);">
                          You have been invited to join <strong style="color: #f5efe6;">Split The G</strong> and compete in live leaderboards, save your pours, and connect with friends.
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                          <tr>
                            <td
                              style="border: 1px solid rgba(197,160,89,0.18); border-radius: 20px; padding: 18px 18px; background: rgba(255,255,255,0.02);"
                            >
                              <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(197,160,89,0.82); font-weight: 700;">
                                Sign in with this email
                              </div>
                              <div style="margin-top: 8px; font-size: 18px; line-height: 26px; color: #f5efe6; font-weight: 500;">
                                ${safeInviteeEmail}
                              </div>
                              <div style="margin-top: 10px; font-size: 14px; line-height: 23px; color: rgba(245,239,230,0.64);">
                                The app will show the invite automatically when you sign in with the same address.
                              </div>
                            </td>
                          </tr>
                        </table>
                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
                          <tr>
                            <td
                              style="border-radius: 16px; background: #c5a059; text-align: center;"
                            >
                              <a
                                href="${inviteUrl}"
                                style="display: inline-block; padding: 15px 28px; color: #050608; font-size: 16px; font-weight: 700; text-decoration: none;"
                              >
                                Open Split The G
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 24px 0 0; font-size: 14px; line-height: 23px; color: rgba(245,239,230,0.62);">
                          Invited by ${safeInviterLabel}
                          <span style="color: rgba(245,239,230,0.42);">•</span>
                          ${safeInviterEmail}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style="padding: 20px 34px 30px; border-top: 1px solid rgba(197,160,89,0.1); font-size: 12px; line-height: 20px; color: rgba(245,239,230,0.48); text-align: center;"
                      >
                        Split The G
                        <span style="color: rgba(245,239,230,0.28);">•</span>
                        Simple pours, live boards, good friends.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
