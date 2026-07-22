import { db } from "@/lib/db";
import { APP_DEFAULT_CATEGORIES } from "@/constants/default-categories";
import { categories } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export async function seedDefaultCategories(userId: string) {
  await db.insert(categories).values(
    APP_DEFAULT_CATEGORIES.map((category) => ({
      userId,
      ...category,
      type: "expense",
    })),
  );

  logger.info("🏷️ Categories seeded");
}
