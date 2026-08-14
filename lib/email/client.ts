// No "server-only" here on purpose — see lib/auth/signup-policy.ts. This is
// reached from auth.ts, which standalone scripts import.
import { Resend } from "resend";

import { logger } from "@/lib/logger";

/**
 * Resend needs two things, and having only one of them is the common case
 * while a domain is still being verified:
 *
 * - `RESEND_API_KEY` authenticates the account
 * - `RESEND_FROM` must be an address on a domain verified in Resend. Resend
 *   refuses to send from anything else, and `onboarding@resend.dev` only
 *   delivers to the account owner's own address.
 *
 * When either is missing, sending is skipped rather than throwing. Invitations
 * are usable without email — the invite link works on its own.
 */
function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

/**
 * Whether outbound email can actually be sent right now.
 *
 * The UI uses this to tell the user whether to expect an email or to copy the
 * invite link and send it themselves.
 */
export function isEmailConfigured(): boolean {
  return getConfig() !== null;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email, or skips when Resend is not fully configured.
 *
 * Never throws: a failed invitation email must not fail the invitation, since
 * the link is the real mechanism.
 *
 * @returns `true` when the message was handed to Resend.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const config = getConfig();

  if (!config) {
    logger.warn("Email not sent — RESEND_API_KEY or RESEND_FROM is missing", { to, subject });

    return false;
  }

  try {
    const resend = new Resend(config.apiKey);

    const { error } = await resend.emails.send({
      from: config.from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      logger.error("Resend rejected the email", error, { to, subject });

      return false;
    }

    logger.info("Email sent", { to, subject });

    return true;
  } catch (error) {
    logger.error("Failed to send email", error, { to, subject });

    return false;
  }
}
