import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { categories } from "@/lib/db/schema/categories";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

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

export async function seedExpenses(organizationId: string, userId: string) {
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
      description: sample.description,
      date: new Date(now.getFullYear(), now.getMonth(), sample.day),
      createdBy: userId,
      updatedBy: userId,
    })),
  );

  logger.info("💸 Expenses seeded");
}
