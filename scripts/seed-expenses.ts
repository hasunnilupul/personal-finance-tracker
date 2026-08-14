import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { categories } from "@/lib/db/schema/categories";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { DEFAULT_CURRENCY } from "@/constants/currencies";

const SAMPLE_EXPENSES = [
  { category: "Food & Dining", amount: "2500.00", description: "Dinner with friends", day: 1 },
  { category: "Transportation", amount: "1200.00", description: "Fuel refill", day: 3 },
  { category: "Shopping", amount: "8500.00", description: "New headphones", day: 5 },
  { category: "Entertainment", amount: "3000.00", description: "Movie tickets", day: 8 },
  { category: "Utilities", amount: "4500.00", description: "Electricity bill", day: 10 },
  { category: "Food & Dining", amount: "750.00", description: "Coffee and snacks", day: 12 },
  { category: "Health", amount: "6000.00", description: "Pharmacy purchase", day: 15 },
  { category: "Transportation", amount: "1800.00", description: "Taxi rides", day: 18 },
];

export async function seedExpenses(
  organizationId: string,
  userId: string,
  baseCurrency: string = DEFAULT_CURRENCY,
) {
  const spaceCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.organizationId, organizationId));

  const categoryMap = Object.fromEntries(
    spaceCategories.map((category) => [category.name, category.id]),
  );

  const now = new Date();

  await db.insert(expenses).values(
    SAMPLE_EXPENSES.map((sample) => ({
      organizationId,
      categoryId: categoryMap[sample.category],
      amount: sample.amount,
      // Seed data is already in the space's own currency, so no conversion.
      currency: baseCurrency,
      baseAmount: sample.amount,
      exchangeRate: "1",
      description: sample.description,
      // Midday UTC, matching how the app records dates — see the note below.
      date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), sample.day, 12)),
      createdBy: userId,
      updatedBy: userId,
    })),
  );

  logger.info("💸 Expenses seeded");
}
