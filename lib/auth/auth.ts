import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ac, roles } from "@/lib/auth/permissions";
import { canSignUp, SIGNUP_NOT_INVITED_MESSAGE } from "@/lib/auth/signup-policy";
import { buildInvitationUrl } from "@/lib/auth/urls";
import { spaceService } from "@/lib/services/space.service";
import { categoryService } from "@/lib/services/category.service";
import { sendInvitationEmail } from "@/lib/email/invitation-email";
import { sendPasswordResetEmail } from "@/lib/email/password-reset-email";
import { userRepository } from "@/lib/repositories/user.repository";
import { DEFAULT_CURRENCY } from "@/constants/currencies";
import { logger } from "@/lib/logger";

/** An hour: long enough to find the email, short enough that a stale one is dead. */
const RESET_PASSWORD_EXPIRES_IN_SECONDS = 60 * 60;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRES_IN_SECONDS,
    // Resetting a password is what somebody does when they think the old one
    // is known to someone else. Leaving their other sessions signed in would
    // leave that someone in.
    revokeSessionsOnPasswordReset: true,
    /**
     * Sends the reset link. Whether the address has an account is never said
     * to the caller — better-auth answers the same either way — and this is
     * only reached when it does.
     *
     * A failed send is logged by `sendEmail` and otherwise ignored, so a Resend
     * outage cannot be told apart from an unknown address by whoever asked.
     */
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: url,
        expiresInMinutes: RESET_PASSWORD_EXPIRES_IN_SECONDS / 60,
      });
    },
    onPasswordReset: async ({ user }) => {
      logger.info("Password reset", { userId: user.id });
    },
  },
  databaseHooks: {
    user: {
      create: {
        /**
         * Enforce invite-only registration.
         *
         * This runs before the user row is written, and covers every route
         * into sign-up — the form, the API, and anything added later — because
         * they all end up creating a user. Guarding the page alone would not.
         */
        before: async (user) => {
          if (await canSignUp(user.email)) {
            return;
          }

          throw new APIError("FORBIDDEN", {
            message: SIGNUP_NOT_INVITED_MESSAGE,
          });
        },

        /**
         * Give every new user their own private ledger.
         *
         * Without this a user would sign in with nowhere to record anything,
         * so a failure here is logged loudly rather than swallowed — but it
         * does not fail the sign-up, since `resolveActiveSpace` surfaces the
         * missing space with a recoverable message.
         */
        after: async (user) => {
          try {
            await spaceService.createPersonalSpace(user);
          } catch (error) {
            logger.error("Failed to create personal space for new user", error, {
              userId: user.id,
            });
          }
        },
      },
    },
    session: {
      create: {
        /**
         * Open each session on the user's personal space, so the app always
         * has an active space to read from.
         */
        before: async (session) => {
          const personal = await spaceService.getPersonalSpace(session.userId);

          if (!personal) {
            return;
          }

          return {
            data: {
              ...session,
              activeOrganizationId: personal.id,
            },
          };
        },
      },
    },
  },
  plugins: [
    /**
     * Optional second factor: an authenticator app, with backup codes.
     *
     * No email or SMS code. Those would make the second factor only as strong as
     * the inbox, and the inbox is exactly what a password reset trusts — so a
     * second factor sent there would add nothing against the attack it is for.
     *
     * Rate limiting and a lockout (ten failures, fifteen minutes) are the
     * plugin's own and left at their defaults. They matter more than they look:
     * a six-digit code is a million guesses, not a secret.
     */
    twoFactor({
      issuer: "FinanceFlow",
      // The plugin's default is plaintext. A backup code is a password that
      // skips the second factor, so it is encrypted at rest like the secret is.
      backupCodeOptions: { storeBackupCodes: "encrypted" },
    }),
    organization({
      ac,
      roles,
      creatorRole: "owner",
      // Only the creator of a shared space can bring people into it, so the
      // invite-capable role is never handed out.
      schema: {
        organization: {
          additionalFields: {
            isPersonal: {
              type: "boolean",
              defaultValue: false,
              input: false,
            },
          },
        },
      },
      /**
       * Emails the invitation when Resend is configured — unless the address
       * already has an account.
       *
       * Somebody with an account is notified in the app instead, by
       * `inviteMemberAction`: that reaches the bell and, if they have push on,
       * the phone, and it arrives whatever `RESEND_FROM` is set to — which is
       * not true of the mail. Sending both by default would be two pings for
       * one invitation, so the email becomes something the owner can add.
       *
       * The lookup lives here rather than at the call site because this hook is
       * the choke point every route into `createInvitation` passes through; the
       * action then repeats it to decide what to tell the owner.
       *
       * The link is the real mechanism — the members page always shows it for
       * copying — so a missing or failed email is logged and ignored rather
       * than failing the invitation.
       */
      sendInvitationEmail: async ({ id, email, organization: space, inviter }) => {
        if (await userRepository.findByEmail(email)) {
          logger.info("Invitation email skipped: the address already has an account", {
            invitationId: id,
          });

          return;
        }

        await sendInvitationEmail({
          to: email,
          spaceName: space.name,
          inviterName: inviter.user.name || inviter.user.email,
          acceptUrl: buildInvitationUrl(id),
        });
      },
      organizationHooks: {
        /**
         * A newly created shared space starts with the same default
         * categories as a personal one.
         */
        afterCreateOrganization: async ({ organization: space, user }) => {
          try {
            await categoryService.seedDefaultCategories({
              organizationId: space.id,
              userId: user.id,
              baseCurrency: space.baseCurrency ?? DEFAULT_CURRENCY,
              // Every space this hook fires for is a shared one — the personal
              // space is written directly by `createPersonalSpace`, before the
              // user has a session for the plugin's endpoint to authorise. So
              // it is seeded with expense categories only: income is recorded
              // in a personal space and nowhere else.
              isPersonal: false,
            });
          } catch (error) {
            logger.error("Failed to seed categories for new space", error, {
              organizationId: space.id,
            });
          }
        },
      },
    }),
  ],
});
