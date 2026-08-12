import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema/exchange-rates";
import { ExchangeRate, NewExchangeRate } from "@/lib/db/models/exchange-rate.model";

export class ExchangeRateRepository {
  /**
   * The rate to use for a pair on a given day.
   *
   * Prefers an exact match for that date, and otherwise falls back to the most
   * recent earlier rate — a Sunday transaction should use Friday's rate rather
   * than nothing at all. A `manual` row beats a fetched one for the same day,
   * which is what makes manual entry an override.
   */
  async findEffective(
    baseCurrency: string,
    quoteCurrency: string,
    asOf: string,
  ): Promise<ExchangeRate | undefined> {
    const [result] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, baseCurrency),
          eq(exchangeRates.quoteCurrency, quoteCurrency),
          lte(exchangeRates.asOf, asOf),
        ),
      )
      // "manual" sorts after "currency-api" alphabetically, so ordering by
      // source descending puts a manual override for the same day first.
      .orderBy(desc(exchangeRates.asOf), desc(exchangeRates.source))
      .limit(1);

    return result;
  }

  /**
   * The oldest rate on record for a pair.
   *
   * Last resort for an entry dated before rate collection began — backdating
   * an expense to before the app was first used is normal, and the provider
   * only serves today's figures. Using the earliest known rate is an
   * approximation, and callers say so in the log.
   */
  async findEarliest(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<ExchangeRate | undefined> {
    const [result] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, baseCurrency),
          eq(exchangeRates.quoteCurrency, quoteCurrency),
        ),
      )
      .orderBy(asc(exchangeRates.asOf), desc(exchangeRates.source))
      .limit(1);

    return result;
  }

  /**
   * Inserts rates, replacing any existing row for the same pair, day and source.
   */
  async upsertMany(rates: NewExchangeRate[]): Promise<void> {
    if (rates.length === 0) {
      return;
    }

    await db
      .insert(exchangeRates)
      .values(rates)
      .onConflictDoUpdate({
        target: [
          exchangeRates.baseCurrency,
          exchangeRates.quoteCurrency,
          exchangeRates.asOf,
          exchangeRates.source,
        ],
        set: { rate: sql`excluded."rate"` },
      });
  }
}

export const exchangeRateRepository = new ExchangeRateRepository();
