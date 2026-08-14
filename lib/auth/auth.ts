import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ac, roles } from "@/lib/auth/permissions";
import { canSignUp, SIGNUP_NOT_INVITED_MESSAGE } from "@/lib/auth/signup-policy";
import { buildInvitationUrl } from "@/lib/auth/urls";
import { spaceService } from "@/lib/services/space.service";
import { categoryService } from "@/lib/services/category.service";
import { sendInvitationEmail } from "@/lib/email/invitation-email";
import { userRepository } from "@/lib/repositories/user.repository";
import { DEFAULT_CURRENCY } from "@/constants/currencies";
import { logger } from "@/lib/logger";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
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
       * Somebody with an account will see an in-app notice the next time they
       * open the app, which arrives whatever `RESEND_FROM` is set to. So the
       * inviter is offered the choice instead of having the email sent out
       * from under them, and `inviteMemberAction` reports which case it was.
       * Emailing anyway would make the choice a lie.
       *
       * The link is the real mechanism — the members page always shows it for
       * copying — so a missing or failed email is logged and ignored rather
       * than failing the invitation.
       */
      sendInvitationEmail: async ({ id, email, organization: space, inviter }) => {
        if (await userRepository.findByEmail(email)) {
          logger.info("Invitation email deferred: the address already has an account", {
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
