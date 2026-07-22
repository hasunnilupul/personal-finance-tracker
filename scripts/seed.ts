import { eq } from "drizzle-orm";
import { auth } from "../lib/auth/auth";
import { logger } from "../lib/logger";
import { db } from "../lib/db";
import { user } from "../lib/db/schema";

async function seed() {
  const email = "demo@financeflow.com";
  const password = "Password123!";

  try {
    const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);

    if (existingUser.length > 0) {
      logger.info("Default user already exists", {
        email,
      });

      return;
    }

    const response = await auth.api.signUpEmail({
      body: {
        name: "Demo User",
        email,
        password,
      },
    });

    logger.info("Default user created", {
      userId: response.user.id,
      email: response.user.email,
    });
  } catch (error) {
    logger.error("Failed to seed default user", error);

    process.exit(1);
  }
}

seed();
