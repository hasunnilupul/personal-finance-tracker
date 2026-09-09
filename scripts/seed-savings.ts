import { db } from "@/lib/db";
import { savings } from "@/lib/db/schema/savings";
import { logger } from "@/lib/logger";
import { DEFAULT_CURRENCY } from "@/constants/currencies";

const SAMPLE_SAVINGS = [
  { amount: "5000.00", description: "Emergency fund top-up", liquidity: "liquid", day: 2 },
  { amount: "10000.00", description: "Index fund contribution", liquidity: "locked", day: 5 },
  { amount: "2000.00", description: "Weekend trip fund", liquidity: "liquid", day: 14 },
] as const;

export async function seedSavings(
  organizationId: string,
  userId: string,
  baseCurrency: string = DEFAULT_CURRENCY,
) {
  const now = new Date();

  await db.insert(savings).values(
    SAMPLE_SAVINGS.map((sample) => ({
      organizationId,
      amount: sample.amount,
      // Seed data is already in the space's own currency, so no conversion.
      currency: baseCurrency,
      baseAmount: sample.amount,
      exchangeRate: "1",
      description: sample.description,
      liquidity: sample.liquidity,
      // Midday UTC, matching how the app records dates — see the note below.
      date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), sample.day, 12)),
      createdBy: userId,
      updatedBy: userId,
    })),
  );

  logger.info("🏦 Savings seeded");
}
