import { varchar, numeric } from "drizzle-orm/pg-core";

import { DEFAULT_CURRENCY } from "@/constants/currencies";

/**
 * Columns every table holding a real transaction amount carries.
 *
 * An entry keeps both what was actually spent (`amount` in `currency`) and
 * what that was worth in the space's base currency at the time (`baseAmount`).
 * Totals and budgets sum `baseAmount`, so a later move in the exchange rate
 * cannot silently rewrite last month's spending.
 *
 * `exchangeRate` records what was used, so a converted figure can always be
 * explained rather than just asserted.
 *
 * Amounts stay `numeric`, not integer minor units: Postgres `numeric` is exact
 * decimal arithmetic, so there is no floating-point error to avoid, and every
 * currency offered here has two decimal places.
 */
export function moneyColumns() {
  return {
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default(DEFAULT_CURRENCY),
    /** `amount` expressed in the space's base currency. */
    baseAmount: numeric("baseAmount", { precision: 12, scale: 2 }).notNull(),
    /** Rate applied to get from `currency` to the base currency. 1 when they match. */
    exchangeRate: numeric("exchangeRate", { precision: 20, scale: 10 }).notNull().default("1"),
  };
}
