import "dotenv/config";

import { auth } from "@/lib/auth/auth";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { spaceService } from "@/lib/services/space.service";
import { seedExpenses } from "@/scripts/seed-expenses";

/**
 * Every table the seed owns. `CASCADE` handles the foreign keys between them.
 */
const SEEDED_TABLES = [
  "budgets",
  "categories",
  "expenses",
  "income",
  "recurringTransactions",
  "savingsGoals",
  "invitation",
  "member",
  "organization",
  "user",
  "session",
  "account",
  "verification",
];

async function seed() {
  logger.info("🌱 Starting database seed...");

  await db.execute(`
    TRUNCATE TABLE
      ${SEEDED_TABLES.map((table) => `"${table}"`).join(",\n      ")}
    RESTART IDENTITY CASCADE;
  `);

  logger.info("🧹 Database cleared");

  const email = "demo@financeflow.com";
  const password = "Password123!";

  try {
    const response = await auth.api.signUpEmail({
      body: {
        name: "Demo User",
        email,
        password,
      },
    });

    const userId = response.user.id;

    logger.info("👤 User created:", { userId, email: response.user.email });

    // The sign-up hook creates the personal space and its default categories.
    const personalSpace = await spaceService.getPersonalSpace(userId);

    if (!personalSpace) {
      throw new Error("Personal space was not created for the demo user");
    }

    logger.info("🏠 Personal space ready", { organizationId: personalSpace.id });

    await seedExpenses(personalSpace.id, userId);

    logger.info("✅ Seed completed");
  } catch (error) {
    logger.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
