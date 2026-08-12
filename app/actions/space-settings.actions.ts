"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { spaceService } from "@/lib/services/space.service";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { SUPPORTED_CURRENCY_CODES } from "@/constants/currencies";
import { logger } from "@/lib/logger";

const baseCurrencySchema = z.object({
  baseCurrency: z.enum(SUPPORTED_CURRENCY_CODES as [string, ...string[]]),
});

export interface SpaceSettingsState {
  error?: string;
  success?: string;
}

/**
 * Changes the currency a space reports in.
 *
 * Existing entries keep the amount that was actually spent and are re-converted
 * into the new base currency, using the rate for each entry's own date — so
 * history stays faithful rather than being re-valued at today's rate.
 */
export async function updateBaseCurrencyAction(
  _previous: SpaceSettingsState,
  formData: FormData,
): Promise<SpaceSettingsState> {
  const parsed = baseCurrencySchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
  });

  if (!parsed.success) {
    return { error: "Pick one of the supported currencies." };
  }

  try {
    const { space } = await requirePermission({ organization: ["update"] });

    if (space.baseCurrency === parsed.data.baseCurrency) {
      return { success: "That is already the base currency." };
    }

    // Warm the cache once so the re-conversion below is not one fetch per row.
    await exchangeRateService.refreshRates(parsed.data.baseCurrency);

    const updated = await spaceService.changeBaseCurrency(space.id, parsed.data.baseCurrency);

    revalidatePath("/", "layout");

    return {
      success: `Base currency is now ${parsed.data.baseCurrency}. ${updated} ${
        updated === 1 ? "entry was" : "entries were"
      } re-converted.`,
    };
  } catch (error) {
    logger.error("Failed to change base currency", error);

    return { error: "Could not change the base currency. Please try again." };
  }
}
