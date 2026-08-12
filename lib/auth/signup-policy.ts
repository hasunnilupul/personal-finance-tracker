// No "server-only" here on purpose: this is reachable from `lib/auth/auth.ts`,
// which the seed script imports. Outside Next's bundler that package throws.
// The module is server-side by construction — it talks to the database.
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/better-auth";
import { invitationRepository } from "@/lib/repositories/invitation.repository";
import { logger } from "@/lib/logger";

/**
 * Whether anyone with the sign-up URL may register.
 *
 * Off by default: this app is for one family, and an open registration form on
 * a public URL is how it stops being that. Set `ALLOW_PUBLIC_SIGNUP=true` to
 * open it up later.
 */
export function isPublicSignupAllowed(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}

/**
 * Whether the database has no users yet.
 *
 * The first account has nobody to invite it, so it is allowed through —
 * otherwise a fresh deployment would be impossible to get into. Every account
 * after it needs an invitation.
 */
async function isFirstEverUser(): Promise<boolean> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);

  return (row?.count ?? 0) === 0;
}

/**
 * Decides whether an email address may create an account.
 *
 * Called from a `before` database hook, so returning `false` stops the user
 * row from ever being written.
 */
export async function canSignUp(email: string): Promise<boolean> {
  if (isPublicSignupAllowed()) {
    return true;
  }

  if (await isFirstEverUser()) {
    logger.info("Allowing sign-up: first user in an empty database", { email });

    return true;
  }

  const invitation = await invitationRepository.findPendingByEmail(email);

  if (!invitation) {
    logger.warn("Rejected sign-up without a pending invitation", { email });

    return false;
  }

  return true;
}

/**
 * Shown to someone who tries to register without an invitation.
 *
 * Deliberately does not distinguish "never invited" from "invitation expired",
 * so the form cannot be used to probe which addresses have been invited.
 */
export const SIGNUP_NOT_INVITED_MESSAGE =
  "Sign-up is invite only. Ask whoever runs this tracker to send you an invitation.";
