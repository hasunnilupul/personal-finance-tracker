import {
  pgTable,
  integer,
  varchar,
  numeric,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Cached conversion rates, one row per currency pair per day.
 *
 * Rates are stored rather than fetched per request for two reasons: the
 * provider is a once-a-day feed, and a transaction's converted amount must be
 * reproducible from the rate that applied on its own date.
 *
 * `source` distinguishes a fetched rate from one entered by hand. A manual row
 * wins over a fetched row for the same day, which is the escape hatch when the
 * feed is wrong, unavailable, or does not cover a pair.
 */
export const exchangeRates = pgTable(
  "exchangeRates",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    baseCurrency: varchar("baseCurrency", { length: 3 }).notNull(),
    quoteCurrency: varchar("quoteCurrency", { length: 3 }).notNull(),
    /**
     * How much of `quoteCurrency` one unit of `baseCurrency` buys.
     *
     * Ten decimal places because rates between a weak and a strong currency
     * are tiny — LKR to USD is around 0.0029914308, and rounding that to four
     * places would lose real money on large amounts.
     */
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    /** The day the rate applies to, not the day it was fetched. */
    asOf: date("asOf").notNull(),
    source: varchar("source", { length: 20 }).notNull(), // 'currency-api' or 'manual'
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("exchangeRates_pair_asOf_source_uq").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.asOf,
      table.source,
    ),
  ],
);
