import { describe, expect, it } from "vitest";

import { formatMoney, parseAmount } from "@/lib/currency/format";

/**
 * Amounts are decimal strings everywhere in this app, because Postgres
 * `numeric` is exact and converting early would risk rounding a value before it
 * is displayed. These two functions are the only places that leave that
 * discipline, so they are where it has to hold.
 */
describe("parseAmount", () => {
  describe("accepts what people actually type", () => {
    it.each([
      ["2500", "2500.00"],
      ["2500.5", "2500.50"],
      ["2,500.00", "2500.00"],
      ["Rs 2,500", "2500.00"],
      ["  19.99  ", "19.99"],
      ["$1,234,567.89", "1234567.89"],
      [".5", "0.50"],
    ])("parses %o as %o", (input, expected) => {
      expect(parseAmount(input)).toBe(expected);
    });
  });

  describe("rejects what is not a usable amount", () => {
    // An unusable amount must come back as null rather than NaN — a NaN that
    // reached a `numeric` column would be a write that fails at the database
    // instead of a message the user can act on.
    it.each(["", "   ", "abc", "0", "0.00", "-50", "1e5", "--5", "."])("rejects %o", (input) => {
      expect(parseAmount(input)).toBeNull();
    });

    it("rejects an amount too large for numeric(12,2)", () => {
      expect(parseAmount("10000000000")).toBeNull();
      expect(parseAmount("9999999999.99")).toBe("9999999999.99");
    });
  });

  it("always returns exactly two decimal places", () => {
    for (const input of ["1", "1.1", "1.005", "999999"]) {
      expect(parseAmount(input)).toMatch(/^\d+\.\d{2}$/);
    }
  });
});

/**
 * Intl separates a currency symbol from its figure with a non-breaking space.
 * Normalising it away keeps these assertions readable — an ordinary space in
 * the expected string would otherwise fail in a way that looks identical on
 * screen.
 */
function plain(value: string): string {
  return value.split(String.fromCharCode(160)).join(" ");
}

describe("formatMoney", () => {
  it("renders the space's own currency with a narrow symbol", () => {
    expect(plain(formatMoney("2500.00", "LKR"))).toBe("Rs 2,500.00");
  });

  it("pads to two decimals", () => {
    expect(formatMoney("19.5", "USD")).toBe("$19.50");
  });

  it("accepts a number as well as a decimal string", () => {
    expect(formatMoney(19.5, "USD")).toBe(formatMoney("19.5", "USD"));
  });

  it("renders negatives, which a net total can be", () => {
    expect(formatMoney("-1200.00", "USD")).toContain("1,200.00");
  });

  it("compacts when asked, for an axis tick", () => {
    expect(formatMoney("1500000", "USD", { compact: true })).toBe("$1.5M");
  });

  describe("degrades rather than blanking the page", () => {
    it("renders an unknown but well-formed code using the code itself", () => {
      // Intl accepts any three-letter code and uses it as the symbol, so this
      // never reaches the catch — worth pinning, because it means an
      // unrecognised currency still renders a correct-looking figure.
      expect(plain(formatMoney("2500.00", "XYZ"))).toBe("XYZ 2,500.00");
    });

    it("falls back rather than throwing on a malformed code", () => {
      // A code that is not three letters makes Intl throw, which would take out
      // the whole render for one bad row.
      expect(formatMoney("2500.00", "NOT-A-CODE")).toBe("NOT-A-CODE 2500.00");
    });

    it.each(["", "   ", "abc", "NaN"])("renders an em dash for the unparseable %o", (input) => {
      // Notably including "" — `Number("")` is 0, so this used to render a
      // missing amount as a confident zero.
      expect(formatMoney(input, "USD")).toBe("—");
    });
  });
});
