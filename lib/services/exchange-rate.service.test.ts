import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { RateProvider } from "@/lib/currency/provider";

const findEffective = vi.fn();
const findEarliest = vi.fn();
const upsertMany = vi.fn();

// Mocked at the module boundary so nothing here reaches a database. The service
// is otherwise the real thing — the conversion arithmetic is what is under test.
vi.mock("@/lib/repositories/exchange-rate.repository", () => ({
  exchangeRateRepository: {
    findEffective: (...args: unknown[]) => findEffective(...args),
    findEarliest: (...args: unknown[]) => findEarliest(...args),
    upsertMany: (...args: unknown[]) => upsertMany(...args),
  },
}));

const { ExchangeRateService } = await import("@/lib/services/exchange-rate.service");
const { isServiceError } = await import("@/lib/services/errors");

/**
 * A provider that returns nothing unless a test says otherwise, so `getRate`
 * falls through to the cache and fallback paths.
 *
 * Typed as the real `RateProvider` so a change to that interface breaks here
 * rather than leaving the tests passing against a shape the app no longer uses.
 */
const emptyProvider: RateProvider & { fetchRates: Mock } = {
  name: "test",
  fetchRates: vi.fn<RateProvider["fetchRates"]>(),
};

function service(provider: RateProvider = emptyProvider) {
  return new ExchangeRateService(provider);
}

const ON = new Date("2026-08-13T12:00:00.000Z");

beforeEach(() => {
  // `resetAllMocks`, not `clearAllMocks` — the latter clears recorded calls but
  // leaves queued `mockResolvedValueOnce` values in place, so one test's
  // sequence would leak into the next.
  vi.resetAllMocks();
  findEffective.mockResolvedValue(undefined);
  findEarliest.mockResolvedValue(undefined);
  emptyProvider.fetchRates.mockResolvedValue(null);
});

describe("convert", () => {
  describe("same currency", () => {
    it("is a no-op at rate 1 without touching the rate store", async () => {
      // The overwhelmingly common case in a single-currency household — it must
      // not cost a lookup, and must never fail.
      await expect(service().convert("2500", "LKR", "LKR", ON)).resolves.toEqual({
        baseAmount: "2500.00",
        rate: "1",
      });

      expect(findEffective).not.toHaveBeenCalled();
    });

    it("still normalises to two decimals", async () => {
      await expect(service().convert("2500.5", "LKR", "LKR", ON)).resolves.toMatchObject({
        baseAmount: "2500.50",
      });
    });
  });

  describe("with a cached rate for the day", () => {
    beforeEach(() => {
      findEffective.mockResolvedValue({ rate: "300.50", asOf: "2026-08-13" });
    });

    it("multiplies and rounds once, at the end", async () => {
      await expect(service().convert("10.00", "USD", "LKR", ON)).resolves.toEqual({
        baseAmount: "3005.00",
        rate: "300.50",
      });
    });

    it("returns the rate it used, so the entry can explain itself later", async () => {
      const { rate } = await service().convert("1", "USD", "LKR", ON);

      expect(rate).toBe("300.50");
    });

    it("does not go to the provider when the day is an exact hit", async () => {
      await service().convert("10.00", "USD", "LKR", ON);

      expect(emptyProvider.fetchRates).not.toHaveBeenCalled();
    });

    it("rounds to two decimals, not half-up, on an exact half-cent", async () => {
      // 0.005 x 3 is 0.015, which as a double sits fractionally below the true
      // half, so `toFixed(2)` gives 0.01 rather than 0.02. Pinned rather than
      // "fixed": a half-cent either way on a single conversion does not matter
      // for a household ledger, and the alternative is decimal arithmetic
      // through the whole money path. If that ever stops being true, this test
      // is where the decision gets revisited.
      findEffective.mockResolvedValue({ rate: "3", asOf: "2026-08-13" });

      await expect(service().convert("0.005", "USD", "LKR", ON)).resolves.toMatchObject({
        baseAmount: "0.01",
      });
    });

    it("keeps a large conversion exact", async () => {
      // The comment in the service claims a 12,2 amount times a rate stays
      // inside the range where doubles are exact — this is that claim, pinned.
      findEffective.mockResolvedValue({ rate: "300.50", asOf: "2026-08-13" });

      await expect(service().convert("9999999.99", "USD", "LKR", ON)).resolves.toMatchObject({
        baseAmount: "3004999996.99",
      });
    });
  });

  describe("when only an older rate exists", () => {
    it("prefers a freshly fetched rate over the stale one", async () => {
      findEffective
        .mockResolvedValueOnce({ rate: "290.00", asOf: "2026-08-01" })
        .mockResolvedValueOnce({ rate: "300.00", asOf: "2026-08-13" });
      emptyProvider.fetchRates.mockResolvedValue({
        date: "2026-08-13",
        rates: { lkr: 300 },
      });

      const { rate } = await service().convert("1", "USD", "LKR", ON);

      expect(rate).toBe("300.00");
    });

    it("falls back to the stale rate rather than refusing the write", async () => {
      // Saving an entry must not depend on a third-party CDN being reachable.
      findEffective.mockResolvedValue({ rate: "290.00", asOf: "2026-08-01" });

      const { rate } = await service().convert("1", "USD", "LKR", ON);

      expect(rate).toBe("290.00");
    });
  });

  describe("for an entry backdated before rate collection began", () => {
    it("falls forward to the earliest rate on record", async () => {
      // The provider only publishes today, so a backdated entry has nothing to
      // look back to. Approximating beats refusing to save.
      findEffective.mockResolvedValue(undefined);
      findEarliest.mockResolvedValue({ rate: "280.00", asOf: "2026-01-01" });

      const { rate } = await service().convert("1", "USD", "LKR", new Date("2025-06-01T12:00:00Z"));

      expect(rate).toBe("280.00");
    });
  });

  describe("when the pair is genuinely unknown", () => {
    it("throws a message the user can act on", async () => {
      await expect(service().convert("1", "USD", "LKR", ON)).rejects.toSatisfy(
        (error: unknown) => isServiceError(error) && error.code === "VALIDATION_FAILED",
      );
    });

    it("names both currencies in the message", async () => {
      await expect(service().convert("1", "USD", "LKR", ON)).rejects.toThrow(/USD.*LKR/);
    });
  });
});
