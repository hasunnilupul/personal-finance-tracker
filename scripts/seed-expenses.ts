import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { categories } from "@/lib/db/schema/categories";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function seedExpenses(userId: string) {
  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));

  const categoryMap = Object.fromEntries(
    userCategories.map((category) => [category.name, category.id]),
  );

  await db.insert(expenses).values([
    {
      userId,
      categoryId: categoryMap["Food & Dining"],
      amount: "2500.00",
      description: "Dinner with friends",
      date: new Date("2026-07-01"),
    },
    {
      userId,
      categoryId: categoryMap["Transportation"],
      amount: "1200.00",
      description: "Fuel refill",
      date: new Date("2026-07-03"),
    },
    {
      userId,
      categoryId: categoryMap["Shopping"],
      amount: "8500.00",
      description: "New headphones",
      date: new Date("2026-07-05"),
    },
    {
      userId,
      categoryId: categoryMap["Entertainment"],
      amount: "3000.00",
      description: "Movie tickets",
      date: new Date("2026-07-08"),
    },
    {
      userId,
      categoryId: categoryMap["Utilities"],
      amount: "4500.00",
      description: "Electricity bill",
      date: new Date("2026-07-10"),
    },
    {
      userId,
      categoryId: categoryMap["Food & Dining"],
      amount: "750.00",
      description: "Coffee and snacks",
      date: new Date("2026-07-12"),
    },
    {
      userId,
      categoryId: categoryMap["Health"],
      amount: "6000.00",
      description: "Pharmacy purchase",
      date: new Date("2026-07-15"),
    },
    {
      userId,
      categoryId: categoryMap["Transportation"],
      amount: "1800.00",
      description: "Taxi rides",
      date: new Date("2026-07-18"),
    },
  ]);

  logger.info("💸 Expenses seeded");
}
