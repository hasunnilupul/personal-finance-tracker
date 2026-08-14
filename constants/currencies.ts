/**
 * Currencies the app offers.
 *
 * The rate provider covers 300+, but a picker with 300 entries is worse than
 * one with the handful a family actually uses. Add to this list as needed —
 * nothing else has to change.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map(
  (currency) => currency.code,
) as CurrencyCode[];

/**
 * Used for a new space, and as the fallback anywhere a currency is missing.
 * Change it in the space settings — this is only the starting point.
 */
export const DEFAULT_CURRENCY: CurrencyCode = "LKR";

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCY_CODES.includes(code as CurrencyCode);
}

export function getCurrency(code: string) {
  return SUPPORTED_CURRENCIES.find((currency) => currency.code === code);
}
