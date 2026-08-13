import { NextRequest, NextResponse } from "next/server";

import { recurringTransactionService } from "@/lib/services/recurring-transaction.service";
import { logger } from "@/lib/logger";

/**
 * Materialises every due recurring transaction, across every space.
 *
 * **An accelerator, not the guarantee.** Occurrences are also materialised when
 * a signed-in user loads the dashboard or the recurring page, which is what
 * makes the feature work at all — `CRON_SECRET` is optional and unset in this
 * deployment, so this endpoint currently refuses to run. What it buys, once
 * configured, is entries appearing in a space nobody has opened for a month.
 *
 * Safe to run alongside the on-read path: materialisation is keyed on
 * `(organizationId, recurringId, date)`, so a cron sweep and a page load racing
 * each other still produce exactly one entry per occurrence.
 *
 * Authorised with `CRON_SECRET` exactly as the rate refresh is — Vercel sends it
 * as a bearer token, and without one configured this refuses rather than sitting
 * open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    logger.error("Recurring sweep called with no CRON_SECRET configured");

    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await recurringTransactionService.catchUpAllSpaces();

  if (result.more) {
    logger.warn("Some templates hit the per-run cap and have more to materialise", {
      created: result.created,
      templates: result.templates,
    });
  }

  return NextResponse.json(result);
}
