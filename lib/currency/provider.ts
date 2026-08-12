import { logger } from "@/lib/logger";

/**
 * Rates for one base currency, keyed by lowercase quote currency code.
 */
export interface FetchedRates {
  /** The day the provider says these rates are for. */
  date: string;
  rates: Record<string, number>;
}

/**
 * Where rates come from.
 *
 * Kept behind an interface so swapping providers is a one-file change — the
 * service, the cache and everything above them are unaware of the source.
 */
export interface RateProvider {
  readonly name: string;
  fetchRates(baseCurrency: string): Promise<FetchedRates | null>;
}

/**
 * The free `@fawazahmed0/currency-api` feed.
 *
 * Chosen because it needs no API key, has no request quota (it is static JSON
 * on a CDN), covers 300+ currencies including LKR, and updates daily. The
 * ECB-backed alternatives were ruled out — they do not carry LKR.
 *
 * Both hosts are the ones the project documents: jsDelivr first, with its
 * Cloudflare Pages mirror as the fallback for when jsDelivr is unreachable.
 */
const HOSTS = [
  (base: string) =>
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`,
  (base: string) => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`,
];

const FETCH_TIMEOUT_MS = 10_000;

export const currencyApiProvider: RateProvider = {
  name: "currency-api",

  async fetchRates(baseCurrency: string): Promise<FetchedRates | null> {
    const base = baseCurrency.toLowerCase();

    for (const buildUrl of HOSTS) {
      const url = buildUrl(base);

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          // These are daily figures; letting Next cache them for an hour keeps
          // a burst of conversions from hammering the CDN.
          next: { revalidate: 3600 },
        });

        if (!response.ok) {
          logger.warn("Rate host returned a non-OK response", { url, status: response.status });
          continue;
        }

        const payload = (await response.json()) as Record<string, unknown>;
        const rates = payload[base];

        if (!rates || typeof rates !== "object") {
          logger.warn("Rate host returned an unexpected shape", { url });
          continue;
        }

        return {
          date:
            typeof payload.date === "string" ? payload.date : new Date().toISOString().slice(0, 10),
          rates: rates as Record<string, number>,
        };
      } catch (error) {
        logger.warn("Rate host unreachable, trying the next one", {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.error("Every rate host failed", undefined, { baseCurrency });

    return null;
  },
};
