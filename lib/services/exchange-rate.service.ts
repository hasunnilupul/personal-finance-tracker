import { exchangeRateRepository } from "@/lib/repositories/exchange-rate.repository";
import { currencyApiProvider, RateProvider } from "@/lib/currency/provider";
import { NewExchangeRate } from "@/lib/db/models/exchange-rate.model";
import { SUPPORTED_CURRENCY_CODES } from "@/constants/currencies";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

/**
 * A conversion, with enough detail to explain the number afterwards.
 */
export interface Conversion {
  /** The converted figure, rounded to 2 decimal places. */
  baseAmount: string;
  /** The rate applied, as a decimal string. */
  rate: string;
}

/**
 * Formats a `Date` as the `YYYY-MM-DD` the rates table is keyed by.
 */
export function toRateDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Multiplies two decimal strings and rounds to 2 places.
 *
 * Amounts arrive as strings because Postgres `numeric` is exact and drizzle
 * hands it over as text. Going through `Number` is safe at these magnitudes —
 * a 12,2 amount times a rate stays far inside the 2^53 integer range where
 * doubles are exact — and the result is rounded once, at the end.
 */
function multiplyAndRound(amount: string, rate: string): string {
  const product = Number(amount) * Number(rate);

  if (!Number.isFinite(product)) {
    throw new ServiceError("VALIDATION_FAILED", "That amount could not be converted.");
  }

  return product.toFixed(2);
}

export class ExchangeRateService {
  constructor(private readonly provider: RateProvider = currencyApiProvider) {}

  /**
   * The rate from one currency to another on a given day.
   *
   * Looks in the cache first, fetches from the provider when nothing is
   * cached, and finally falls back to the most recent rate on record. Returns
   * `null` only when the pair is genuinely unknown.
   */
  async getRate(from: string, to: string, on: Date = new Date()): Promise<string | null> {
    if (from === to) {
      return "1";
    }

    const asOf = toRateDate(on);

    const cached = await exchangeRateRepository.findEffective(from, to, asOf);

    // An exact hit for the requested day is authoritative; an older row is
    // only used after trying to fetch something fresher.
    if (cached?.asOf === asOf) {
      return cached.rate;
    }

    const fetched = await this.refreshRates(from);

    if (fetched) {
      const refreshed = await exchangeRateRepository.findEffective(from, to, asOf);

      if (refreshed) {
        return refreshed.rate;
      }
    }

    if (cached) {
      logger.warn("Using a stale exchange rate", { from, to, asOf, rateDate: cached.asOf });

      return cached.rate;
    }

    // Nothing on or before the requested day. This is the normal case for an
    // entry backdated to before rate collection started — the provider only
    // publishes current figures, so there is no history to reach back into.
    // The earliest rate on record is a better answer than refusing to save.
    const earliest = await exchangeRateRepository.findEarliest(from, to);

    if (earliest) {
      logger.warn("Entry predates the oldest known rate, approximating", {
        from,
        to,
        asOf,
        rateDate: earliest.asOf,
      });

      return earliest.rate;
    }

    logger.error("No exchange rate available", undefined, { from, to, asOf });

    return null;
  }

  /**
   * Converts an amount into a base currency.
   *
   * Used when an entry is written, so the stored figure reflects the rate that
   * applied on the entry's own date and later rate moves cannot rewrite past
   * totals.
   *
   * @throws {ServiceError} `VALIDATION_FAILED` when no rate can be found.
   */
  async convert(
    amount: string,
    from: string,
    to: string,
    on: Date = new Date(),
  ): Promise<Conversion> {
    if (from === to) {
      return { baseAmount: Number(amount).toFixed(2), rate: "1" };
    }

    const rate = await this.getRate(from, to, on);

    if (!rate) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        `No exchange rate is available for ${from} to ${to}. Add one manually and try again.`,
      );
    }

    return { baseAmount: multiplyAndRound(amount, rate), rate };
  }

  /**
   * Fetches and caches every supported rate for one base currency.
   *
   * Called on demand by {@link getRate} and once a day by the cron route.
   *
   * @returns `true` when rates were stored.
   */
  async refreshRates(baseCurrency: string): Promise<boolean> {
    const fetched = await this.provider.fetchRates(baseCurrency);

    if (!fetched) {
      return false;
    }

    const rows: NewExchangeRate[] = [];

    for (const quote of SUPPORTED_CURRENCY_CODES) {
      if (quote === baseCurrency) {
        continue;
      }

      const rate = fetched.rates[quote.toLowerCase()];

      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        continue;
      }

      rows.push({
        baseCurrency,
        quoteCurrency: quote,
        // Ten decimal places matches the column and keeps tiny rates intact.
        rate: rate.toFixed(10),
        asOf: fetched.date,
        source: this.provider.name,
      });
    }

    await exchangeRateRepository.upsertMany(rows);

    logger.info("Exchange rates refreshed", {
      baseCurrency,
      asOf: fetched.date,
      pairs: rows.length,
    });

    return rows.length > 0;
  }

  /**
   * Records a rate by hand, overriding whatever the feed says for that day.
   */
  async setManualRate(
    baseCurrency: string,
    quoteCurrency: string,
    rate: string,
    on: Date = new Date(),
  ): Promise<void> {
    await exchangeRateRepository.upsertMany([
      {
        baseCurrency,
        quoteCurrency,
        rate,
        asOf: toRateDate(on),
        source: "manual",
      },
    ]);

    logger.info("Manual exchange rate set", { baseCurrency, quoteCurrency, rate });
  }
}

export const exchangeRateService = new ExchangeRateService();
