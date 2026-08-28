import "dotenv/config";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { organization } from "@/lib/db/schema/organization";
import { spaceRepository } from "@/lib/repositories/space.repository";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";

/**
 * Fills in `personalBaseAmount` for the shared-space expenses the migration
 * could not.
 *
 * The migration handles every row whose shared space and whose creator's
 * personal space already report in the same currency — for those the figure is
 * a copy of one that was already computed, and SQL can do it. What is left is
 * the rows where the two currencies differ, and each of those needs a rate for
 * its own date, which only the app can reach.
 *
 * Until this runs those rows read as their shared-space `baseAmount`, which is
 * the number the app showed before any of this existed. So the app is correct
 * without it and *more* correct with it — this is not a step a deploy waits on.
 *
 * Safe to run more than once: it only ever looks at rows still null, so a
 * second run over a finished backfill does nothing. Run it with
 * `pnpm tsx ./scripts/backfill-personal-amounts.ts`.
 */
async function main() {
  const pending = await db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      createdBy: expenses.createdBy,
    })
    .from(expenses)
    .innerJoin(organization, eq(expenses.organizationId, organization.id))
    .where(
      and(
        eq(organization.isPersonal, false),
        isNull(expenses.personalBaseAmount),
        // A row whose creator has been deleted has no personal ledger to belong
        // to, so there is no currency to convert into. Those stay null for good.
        isNotNull(expenses.createdBy),
      ),
    );

  if (pending.length === 0) {
    console.log("Nothing to backfill: every shared expense already carries a personal amount.");
    return;
  }

  console.log(
    `${pending.length} shared ${pending.length === 1 ? "expense" : "expenses"} to convert.`,
  );

  // One lookup per person rather than per row: a household has a handful of
  // members and potentially years of entries.
  const currencies = new Map<string, string | null>();

  const personalCurrency = async (userId: string): Promise<string | null> => {
    if (!currencies.has(userId)) {
      const personal = await spaceRepository.findPersonalSpace(userId);

      currencies.set(userId, personal?.baseCurrency ?? null);
    }

    return currencies.get(userId) ?? null;
  };

  let converted = 0;
  let skipped = 0;

  for (const row of pending) {
    const target = await personalCurrency(row.createdBy as string);

    if (!target) {
      console.warn(`Expense ${row.id}: its creator has no personal space. Left as it was.`);
      skipped += 1;
      continue;
    }

    try {
      const { baseAmount, rate } = await exchangeRateService.convert(
        row.amount,
        row.currency,
        target,
        row.date,
      );

      await db
        .update(expenses)
        .set({ personalBaseAmount: baseAmount, personalExchangeRate: rate })
        .where(eq(expenses.id, row.id));

      converted += 1;
    } catch (error) {
      // One unreachable rate should not stop the rest. The row keeps reading as
      // its shared-space amount, which is where it started.
      console.warn(`Expense ${row.id}: could not convert ${row.currency} to ${target}.`, error);
      skipped += 1;
    }
  }

  console.log(`Converted ${converted}. Left alone ${skipped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
