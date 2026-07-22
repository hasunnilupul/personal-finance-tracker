import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { seedDefaultCategories } from "@/scripts/seed-categories";
import { seedExpenses } from "@/scripts/seed-expenses";

async function seed() {
  logger.info("🌱 Starting database seed...");

  // Clear tables
  await db.execute(`
    TRUNCATE TABLE 
      "categories",
      "user",
      "session",
      "account",
      "verification"
    RESTART IDENTITY CASCADE;
  `);

  logger.info("🧹 Database cleared");

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

    logger.info("👤 User created:", { userId: response.user.id, email: response.user.email });

    // seed default categories for the user
    await seedDefaultCategories(response.user.id);

    // seed sample expenses for the user
    await seedExpenses(response.user.id);

    logger.info("✅ Seed completed");
  } catch (error) {
    logger.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
