import "dotenv/config";

import { auth } from "@/lib/auth/auth";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { seedDefaultCategories } from "@/scripts/seed-categories";
import { seedExpenses } from "@/scripts/seed-expenses";

/**
 * Every table the seed owns, ordered so the statement reads top-down from
 * domain data to auth data. `CASCADE` handles the foreign keys between them.
 */
const SEEDED_TABLES = [
  "budgets",
  "categories",
  "expenses",
  "income",
  "recurringTransactions",
  "savingsGoals",
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
