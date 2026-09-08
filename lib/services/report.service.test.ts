import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";
import { DateRange } from "@/lib/reports/range";

/**
 * The reports summary's running balance — the same idea the dashboard carries,
 * anchored to a range instead of a calendar month: `carriedBalance` is
 * everything earned minus everything spent *before* `range.from`, and
 * `balance` adds the range's own net on top.
 *
 * What is under test is the filters `getReport` asks for and how the two
 * figures they return turn into `summary.carriedBalance`/`balance` — not the
 * sum itself, which `transaction-query.ts` already owns.
 */

const sumTransactions = vi.fn();
const sumByCategoryWithNames = vi.fn();
const sumByMonth = vi.fn();

vi.mock("@/lib/repositories/transaction-query", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories/transaction-query")>(
    "@/lib/repositories/transaction-query",
  );

  return {
    inSpace: actual.inSpace,
    inPersonalLedger: actual.inPersonalLedger,
    sumTransactions: (...args: unknown[]) => sumTransactions(...args),
    sumByCategoryWithNames: (...args: unknown[]) => sumByCategoryWithNames(...args),
    sumByMonth: (...args: unknown[]) => sumByMonth(...args),
  };
});

const { reportService } = await import("@/lib/services/report.service");

const personal: SpaceContext = {
  organizationId: "org-personal",
  userId: "user-me",
  baseCurrency: "LKR",
  isPersonal: true,
};

const shared: SpaceContext = {
  organizationId: "org-household",
  userId: "user-me",
  baseCurrency: "LKR",
  isPersonal: false,
};

const RANGE: DateRange = {
  key: "this-month",
  from: "2026-09-01",
  to: "2026-09-30",
  label: "This month",
};

/** Whether a call asked for the range (has both bounds) or the carried figure (`to` only). */
function isCarriedCall(filters: { from?: string; to?: string } | undefined): boolean {
  return filters !== undefined && filters.from === undefined && filters.to !== undefined;
}

beforeEach(() => {
  vi.resetAllMocks();
  sumByCategoryWithNames.mockResolvedValue([]);
  sumByMonth.mockResolvedValue(new Map());
});

describe("the reports summary's running balance", () => {
  it("carries everything before the range into balance", async () => {
    sumTransactions.mockImplementation(
      async (table: { name?: string }, _scope: unknown, filters?: { from?: string }) => {
        const inRange = filters?.from !== undefined;
        const isIncome = table === (await import("@/lib/db/schema/income")).income;

        if (isIncome) {
          return inRange ? "1000.00" : "5000.00";
        }

        return inRange ? "400.00" : "3000.00";
      },
    );

    const report = await reportService.getReport(personal, RANGE);

    expect(report.summary.income).toBe("1000.00");
    expect(report.summary.expense).toBe("400.00");
    expect(report.summary.net).toBe("600.00");
    // 5000.00 earned - 3000.00 spent before the range.
    expect(report.summary.carriedBalance).toBe("2000.00");
    expect(report.summary.balance).toBe("2600.00");
  });

  it("asks for the carried figure with no lower bound, ending the day before the range", async () => {
    sumTransactions.mockResolvedValue("0.00");

    await reportService.getReport(personal, RANGE);

    const carriedCalls = sumTransactions.mock.calls.filter(([, , filters]) =>
      isCarriedCall(filters),
    );

    expect(carriedCalls).toHaveLength(2); // income and expense
    expect(carriedCalls.every(([, , filters]) => filters.to === "2026-08-31")).toBe(true);
  });

  it("does not run a balance in a shared space, which has no income of its own", async () => {
    sumTransactions.mockResolvedValue("400.00");

    const report = await reportService.getReport(shared, RANGE);

    expect(report.summary.carriedBalance).toBe("0.00");
    expect(report.summary.balance).toBe("0.00");
    expect(sumTransactions.mock.calls.some(([, , filters]) => isCarriedCall(filters))).toBe(false);
  });

  it("can be negative, when more was ever spent than earned", async () => {
    sumTransactions.mockImplementation(
      async (table: { name?: string }, _scope: unknown, filters?: { from?: string }) => {
        const inRange = filters?.from !== undefined;
        const isIncome = table === (await import("@/lib/db/schema/income")).income;

        if (isIncome) {
          return inRange ? "0.00" : "100.00";
        }

        return inRange ? "50.00" : "300.00";
      },
    );

    const report = await reportService.getReport(personal, RANGE);

    expect(report.summary.carriedBalance).toBe("-200.00");
    expect(report.summary.balance).toBe("-250.00");
  });
});
