import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { exchangeRates } from "@/lib/db/schema/exchange-rates";

export type ExchangeRate = InferSelectModel<typeof exchangeRates>;
export type NewExchangeRate = InferInsertModel<typeof exchangeRates>;

/**
 * Where a rate came from. A `manual` row overrides a fetched one for the same
 * day, so a bad or missing feed can always be corrected by hand.
 */
export type RateSource = "currency-api" | "manual";
