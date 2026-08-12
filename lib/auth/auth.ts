import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ac, roles } from "@/lib/auth/permissions";
import { spaceService } from "@/lib/services/space.service";
import { categoryService } from "@/lib/services/category.service";
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
