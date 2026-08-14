// No "server-only" here on purpose — see lib/auth/signup-policy.ts.
import { sendEmail } from "@/lib/email/client";

export interface InvitationEmailOptions {
  to: string;
  spaceName: string;
  inviterName: string;
  acceptUrl: string;
}

/**
 * Escapes text before it goes into the HTML body.
 *
 * Space names and display names are user-supplied, and an email client is not
 * a place to find out that they were not escaped.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Emails someone an invitation to a shared space.
 *
 * Deliberately plain HTML with inline styles — email clients strip stylesheets,
 * and this is not worth a rendering dependency.
 */
export async function sendInvitationEmail({
  to,
  spaceName,
  inviterName,
  acceptUrl,
}: InvitationEmailOptions): Promise<boolean> {
  const safeSpace = escapeHtml(spaceName);
  const safeInviter = escapeHtml(inviterName);

  const subject = `${inviterName} invited you to ${spaceName} on FinanceFlow`;

  const text = [
    `${inviterName} invited you to join "${spaceName}" on FinanceFlow.`,
    "",
    "FinanceFlow is a shared space for tracking joint expenses. Your own",
    "personal ledger stays private — only entries in this shared space are visible",
    "to the people in it.",
    "",
    `Accept the invitation: ${acceptUrl}`,
    "",
    "If you were not expecting this, you can ignore this email.",
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#18181b;max-width:520px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 16px">You have been invited to ${safeSpace}</h1>

  <p style="margin:0 0 16px">
    <strong>${safeInviter}</strong> invited you to join &ldquo;${safeSpace}&rdquo; on FinanceFlow.
  </p>

  <p style="margin:0 0 24px;color:#52525b">
    A shared space is for tracking joint expenses together. Your own personal
    ledger stays private &mdash; only entries in this shared space are visible to
    the people in it.
  </p>

  <p style="margin:0 0 24px">
    <a href="${acceptUrl}" style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;padding:10px 20px;border-radius:9999px;font-weight:500">
      Accept invitation
    </a>
  </p>

  <p style="margin:0 0 8px;color:#71717a;font-size:13px">
    Or paste this link into your browser:
  </p>
  <p style="margin:0 0 24px;color:#71717a;font-size:13px;word-break:break-all">
    ${acceptUrl}
  </p>

  <p style="margin:0;color:#a1a1aa;font-size:13px">
    If you were not expecting this, you can ignore this email.
  </p>
</div>`.trim();

  return sendEmail({ to, subject, html, text });
}
