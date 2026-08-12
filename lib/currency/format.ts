import { DEFAULT_CURRENCY } from "@/constants/currencies";

/**
 * Formats an amount for display.
 *
 * Amounts are decimal strings everywhere else in the app, because that is what
 * Postgres `numeric` gives back and converting early would risk rounding a
 * value before it is displayed.
 *
 * @example
 * ```ts
 * formatMoney("2500.00", "LKR"); // "Rs 2,500.00"
 * formatMoney("19.5", "USD");    // "$19.50"
 * ```
 */
export function formatMoney(
  amount: string | number,
  currency: string = DEFAULT_CURRENCY,
  options: { locale?: string; compact?: boolean } = {},
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(value)) {
    return "—";
  }

  const { locale = "en-LK", compact = false } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      // "narrowSymbol" gives "Rs 2,500.00" rather than "LKR 2,500.00", and
      // still renders zero-decimal currencies like JPY correctly.
      currencyDisplay: "narrowSymbol",
      notation: compact ? "compact" : "standard",
    }).format(value);
  } catch {
    // An unrecognised currency code should not blank out a page.
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Parses a user-typed amount into a `numeric`-safe decimal string.
 *
 * Accepts what people actually type — thousands separators, a leading symbol,
 * surrounding spaces — and rejects anything that is not a positive number.
 *
 * @returns The normalised string, or `null` when the input is not usable.
 */
export function parseAmount(input: string): string | null {
  const cleaned = input.replace(/[^\d.-]/g, "");

  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) {
    return null;
  }

  const value = Number(cleaned);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  // numeric(12,2) tops out below 10^10 once scale is accounted for.
  if (value >= 10_000_000_000) {
    return null;
  }

  return value.toFixed(2);
}
