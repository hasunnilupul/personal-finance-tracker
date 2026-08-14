import { NextRequest, NextResponse } from "next/server";

import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { spaceRepository } from "@/lib/repositories/space.repository";
import { SUPPORTED_CURRENCY_CODES } from "@/constants/currencies";
import { logger } from "@/lib/logger";

/**
 * Refreshes cached exchange rates once a day.
 *
 * A route handler rather than a server action because Vercel Cron invokes it
 * over HTTP. Rates are also fetched on demand when a conversion misses the
 * cache, so this is an optimisation and a safety net, not the only path.
 *
 * Authorised with `CRON_SECRET`: Vercel sends it as a bearer token, and
 * without one configured the endpoint refuses to run rather than sitting open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    logger.error("Rate refresh called with no CRON_SECRET configured");

    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the currencies spaces actually report in need to be a base; every
  // supported currency is fetched as a quote against each of them.
  const baseCurrencies = await spaceRepository.listDistinctBaseCurrencies();

  const targets = baseCurrencies.length > 0 ? baseCurrencies : [SUPPORTED_CURRENCY_CODES[0]];

  const results = await Promise.all(
    targets.map(async (base) => ({
      base,
      refreshed: await exchangeRateService.refreshRates(base),
    })),
  );

  const failed = results.filter((result) => !result.refreshed).map((result) => result.base);

  if (failed.length > 0) {
    logger.warn("Some base currencies could not be refreshed", { failed });
  }

  return NextResponse.json({
    refreshed: results.filter((result) => result.refreshed).map((result) => result.base),
    failed,
  });
}
