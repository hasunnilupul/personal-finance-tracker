// No "server-only" here on purpose — see lib/auth/signup-policy.ts.
import { isEmailConfigured, sendEmail } from "@/lib/email/client";
import { escapeHtml } from "@/lib/email/escape-html";
import { logger } from "@/lib/logger";

export interface PasswordResetEmailOptions {
  to: string;
  name: string;
  resetUrl: string;
  /** How long the link works, in minutes. Said in the body so nobody wonders. */
  expiresInMinutes: number;
}

/**
 * Emails someone a link to choose a new password.
 *
 * Plain HTML with inline styles, like the invitation — see that file for why.
 *
 * **When email is not configured the link is logged outside production, and
 * only then.** Without it, trying "forgot password" on a development machine
 * does nothing visible, which reads as broken. In production the link is a
 * credential and stays out of the logs.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailOptions): Promise<boolean> {
  if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
    logger.info("Password reset link (email is not configured)", { to, resetUrl });
  }

  const safeName = escapeHtml(name || "there");

  const subject = "Reset your FinanceFlow password";

  const text = [
    `Hi ${name || "there"},`,
    "",
    "Somebody asked to reset the password for your FinanceFlow account.",
    "",
    `Choose a new one: ${resetUrl}`,
    "",
    `The link works for ${expiresInMinutes} minutes and only once.`,
    "",
    "If this was not you, ignore this email — your password has not changed.",
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#18181b;max-width:520px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 16px">Reset your password</h1>

  <p style="margin:0 0 16px">Hi ${safeName},</p>

  <p style="margin:0 0 24px;color:#52525b">
    Somebody asked to reset the password for your FinanceFlow account. If that
    was you, choose a new one below. The link works for ${expiresInMinutes}
    minutes and only once.
  </p>

  <p style="margin:0 0 24px">
    <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;padding:10px 20px;border-radius:9999px;font-weight:500">
      Choose a new password
    </a>
  </p>

  <p style="margin:0 0 8px;color:#71717a;font-size:13px">
    Or paste this link into your browser:
  </p>
  <p style="margin:0 0 24px;color:#71717a;font-size:13px;word-break:break-all">
    ${escapeHtml(resetUrl)}
  </p>

  <p style="margin:0;color:#a1a1aa;font-size:13px">
    If this was not you, ignore this email &mdash; your password has not changed.
  </p>
</div>`.trim();

  return sendEmail({ to, subject, html, text });
}
