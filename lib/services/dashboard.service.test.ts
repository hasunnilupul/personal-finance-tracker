import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";

/**
 * The dashboard's running balance: `balance` is everything earned minus
 * everything spent up to and including this month, split into `carriedBalance`
 * (before this month) and this month's own net.
 *
 * The service composes over `transactionService.total`, so what is under test
 * here is which filters it asks for and how the two figures it gets back turn
 * into the three the page reads — not the sum itself, which
 * `transaction-query.ts` already owns.
 */

const total = vi.fn();
const list = vi.fn();
const catchUp = vi.fn();
const getOverview = vi.fn();

vi.mock("@/lib/services/transaction.service", () => ({
  transactionService: {
    total: (...args: unknown[]) => total(...args),
    list: (...args: unknown[]) => list(...args),
  },
}));

vi.mock("@/lib/services/recurring-transaction.service", () => ({
  recurringTransactionService: {
    catchUp: (...args: unknown[]) => catchUp(...args),
  },
}));

vi.mock("@/lib/services/budget.service", () => ({
  budgetService: {
    getOverview: (...args: unknown[]) => getOverview(...args),
  },
}));

const { dashboardService } = await import("@/lib/services/dashboard.service");

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 25 };
const EMPTY_OVERVIEW = {
  monthly: { budgets: [], summary: { overCount: 0 } },
};

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

/** Whether a call asked for the current month (has both bounds) or the carried figure (`to` only). */
function isCarriedCall(filters: { from?: string; to?: string } | undefined): boolean {
  return filters !== undefined && filters.from === undefined && filters.to !== undefined;
}

beforeEach(() => {
  vi.resetAllMocks();
  catchUp.mockResolvedValue(undefined);
  list.mockResolvedValue(EMPTY_PAGE);
  getOverview.mockResolvedValue(EMPTY_OVERVIEW);
});

describe("the running balance", () => {
  it("carries every prior month's net into this month's balance", async () => {
    total.mockImplementation(
      async (_ctx: SpaceContext, kind: "income" | "expense", filters?: { from?: string }) => {
        const thisMonth = filters?.from !== undefined;

        if (kind === "income") {
          return thisMonth ? "1000.00" : "5000.00";
        }

        return thisMonth ? "400.00" : "3000.00";
      },
    );

    const data = await dashboardService.getDashboard(personal);

    expect(data.totals.income).toBe("1000.00");
    expect(data.totals.expense).toBe("400.00");
    expect(data.totals.net).toBe("600.00");
    // Carried in from before this month: 5000.00 earned - 3000.00 spent.
    expect(data.carriedBalance).toBe("2000.00");
    // Carried balance plus this month's own net.
    expect(data.balance).toBe("2600.00");
  });

  it("asks for the carried figure with no lower bound, so it sums all of history", async () => {
    total.mockResolvedValue("0.00");

    await dashboardService.getDashboard(personal);

    const carriedCalls = total.mock.calls.filter(([, , filters]) => isCarriedCall(filters));

    expect(carriedCalls).toHaveLength(2); // income and expense
    expect(carriedCalls.every(([, , filters]) => filters.from === undefined)).toBe(true);
  });

  it("does not run a balance in a shared space, which has no income of its own", async () => {
    total.mockResolvedValue("400.00");

    const data = await dashboardService.getDashboard(shared);

    expect(data.carriedBalance).toBe("0.00");
    expect(data.balance).toBe("0.00");
    expect(total.mock.calls.some(([, , filters]) => isCarriedCall(filters))).toBe(false);
  });

  it("can be negative, when more was spent than was ever earned", async () => {
    total.mockImplementation(
      async (_ctx: SpaceContext, kind: "income" | "expense", filters?: { from?: string }) => {
        const thisMonth = filters?.from !== undefined;

        if (kind === "income") {
          return thisMonth ? "0.00" : "100.00";
        }

        return thisMonth ? "50.00" : "300.00";
      },
    );

    const data = await dashboardService.getDashboard(personal);

    expect(data.carriedBalance).toBe("-200.00");
    expect(data.balance).toBe("-250.00");
  });
});
