import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";

/**
 * Crossing a budget is caused by a write, so the notice is raised at write
 * time rather than swept for. Three things decide whether that is bearable to
 * live with:
 *
 * - it must not fire on income, which no limit applies to;
 * - it must cost nothing when the category has no budget, which is the usual
 *   case and would otherwise put two queries on every expense;
 * - it must key on the budget and its window, because the *second* expense of
 *   an overspent month crosses the same limit again, and so does the third.
 */

const budgetFindByCategory = vi.fn();
const sumBaseAmountByCategory = vi.fn();
const notifySpace = vi.fn();
const expenseCreate = vi.fn();
const incomeCreate = vi.fn();
const categoryFindById = vi.fn();
const convert = vi.fn();

vi.mock("@/lib/repositories/budget.repository", () => ({
  budgetRepository: {
    findByCategory: (...args: unknown[]) => budgetFindByCategory(...args),
    findByCategoryAndPeriod: vi.fn(),
    findAllWithCategory: vi.fn(),
  },
}));

vi.mock("@/lib/repositories/transaction-query", () => ({
  sumBaseAmountByCategory: (...args: unknown[]) => sumBaseAmountByCategory(...args),
  findTransactionPage: vi.fn(),
  listTransactionAuthors: vi.fn(),
  sumTransactions: vi.fn(),
}));

vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    notifySpace: (...args: unknown[]) => notifySpace(...args),
  },
  NOTIFICATION_PAGE_SIZE: 20,
}));

vi.mock("@/lib/repositories/expense.repository", () => ({
  expenseRepository: {
    create: (...args: unknown[]) => expenseCreate(...args),
    createIfAbsent: (...args: unknown[]) => expenseCreate(...args),
  },
}));

vi.mock("@/lib/repositories/income.repository", () => ({
  incomeRepository: {
    create: (...args: unknown[]) => incomeCreate(...args),
    createIfAbsent: (...args: unknown[]) => incomeCreate(...args),
  },
}));

vi.mock("@/lib/repositories/category.repository", () => ({
  categoryRepository: {
    findById: (...args: unknown[]) => categoryFindById(...args),
  },
}));

vi.mock("@/lib/services/exchange-rate.service", () => ({
  exchangeRateService: {
    convert: (...args: unknown[]) => convert(...args),
  },
}));

const { transactionService } = await import("@/lib/services/transaction.service");

const ctx: SpaceContext = {
  organizationId: "org-mine",
  userId: "user-me",
  baseCurrency: "LKR",
  // A personal space, so an expense needs no second conversion and these
  // fixtures stay about the thing each file is testing.
  isPersonal: true,
};

const AUGUST = new Date("2026-08-13T12:00:00.000Z");

const monthlyBudget = {
  id: 7,
  categoryId: 5,
  amount: "10000.00",
  period: "monthly",
  startDate: new Date("2026-01-01T12:00:00.000Z"),
  organizationId: "org-mine",
};

const entry = { amount: "500.00", currency: "LKR", date: AUGUST, categoryId: 5 };

beforeEach(() => {
  vi.resetAllMocks();
  convert.mockResolvedValue({ baseAmount: "500.00", rate: "1" });
  categoryFindById.mockResolvedValue({ id: 5, type: "expense", organizationId: "org-mine" });
  expenseCreate.mockImplementation(async (row: unknown) => ({ id: 1, ...(row as object) }));
  incomeCreate.mockImplementation(async (row: unknown) => ({ id: 1, ...(row as object) }));
  budgetFindByCategory.mockResolvedValue([]);
  sumBaseAmountByCategory.mockResolvedValue(new Map());
  notifySpace.mockResolvedValue([]);
});

describe("an expense that crosses a budget says so", () => {
  beforeEach(() => {
    budgetFindByCategory.mockResolvedValue([monthlyBudget]);
  });

  it("notifies when the period's spend passes the limit", async () => {
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "12000.00"]]));

    await transactionService.create(ctx, "expense", entry);

    expect(notifySpace).toHaveBeenCalledTimes(1);
    const [organizationId, input] = notifySpace.mock.calls[0] as [string, { type: string }];
    expect(organizationId).toBe("org-mine");
    expect(input.type).toBe("budget_overspend");
  });

  it("keys on the budget and the window it was crossed in", async () => {
    // The second expense of an overspent month crosses the same limit again.
    // Without this key it would notify again, and so would the third.
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "12000.00"]]));

    await transactionService.create(ctx, "expense", entry);

    const [, input] = notifySpace.mock.calls[0] as [string, { dedupeKey: string }];
    expect(input.dedupeKey).toBe("budget:7:2026-08-01");
  });

  it("says nothing while the spend is well under the limit", async () => {
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "5000.00"]]));

    await transactionService.create(ctx, "expense", entry);

    expect(notifySpace).not.toHaveBeenCalled();
  });

  it("warns rather than accuses when the spend is near but under the limit", async () => {
    // 9,999.99 of 10,000 is not an overspend, and until Feature 19 it was also
    // not worth mentioning. It is now: this is the last moment saying something
    // can still change what somebody does.
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "9999.99"]]));

    await transactionService.create(ctx, "expense", entry);

    const [, input] = notifySpace.mock.calls[0] as [string, { type: string; body: string }];
    expect(input.type).toBe("budget_warning");
    expect(input.body).toContain("left");
  });

  it("warns when the spend exactly equals the limit", async () => {
    // Spending your whole budget is not overspending it, so this must not be
    // the overspend notice — but there is nothing left, so it is not silence
    // either.
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "10000.00"]]));

    await transactionService.create(ctx, "expense", entry);

    const [, input] = notifySpace.mock.calls[0] as [string, { type: string }];
    expect(input.type).toBe("budget_warning");
  });

  it("does not warn a penny below the threshold, and does at it", async () => {
    // The boundary itself, asserted from both sides. A threshold that is out by
    // one comparison fires a month early or never, and neither shows up in a
    // test that only checks a value in the middle of the range.
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "7999.99"]]));
    await transactionService.create(ctx, "expense", entry);
    expect(notifySpace).not.toHaveBeenCalled();

    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "8000.00"]]));
    await transactionService.create(ctx, "expense", entry);
    expect(notifySpace).toHaveBeenCalledTimes(1);
  });

  it("keys a warning apart from the breach, or the breach is never announced", async () => {
    // The failure this prevents is silent and total. `dedupeKey` is a unique
    // constraint with `onConflictDoNothing`, so if the warning claimed
    // `budget:7:2026-08-01` first, the overspend notice that followed would be
    // dropped -- and passing the limit would say nothing at all.
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "9000.00"]]));

    await transactionService.create(ctx, "expense", entry);

    const [, input] = notifySpace.mock.calls[0] as [string, { dedupeKey: string }];
    expect(input.dedupeKey).toBe("budget:7:2026-08-01:warning");
  });

  it("ignores a limit that took effect after the window", async () => {
    budgetFindByCategory.mockResolvedValue([
      { ...monthlyBudget, startDate: new Date("2026-12-01T12:00:00.000Z") },
    ]);
    sumBaseAmountByCategory.mockResolvedValue(new Map([[5, "12000.00"]]));

    await transactionService.create(ctx, "expense", entry);

    expect(notifySpace).not.toHaveBeenCalled();
  });
});

describe("what it does not do", () => {
  it("does not look at budgets for income", async () => {
    // An income category, or the scoping guard would refuse it before the
    // overspend path is even reached.
    categoryFindById.mockResolvedValue({ id: 5, type: "income", organizationId: "org-mine" });

    await transactionService.create(ctx, "income", entry);

    expect(budgetFindByCategory).not.toHaveBeenCalled();
    expect(notifySpace).not.toHaveBeenCalled();
  });

  it("does not look at budgets for an uncategorised expense", async () => {
    await transactionService.create(ctx, "expense", { ...entry, categoryId: null });

    expect(budgetFindByCategory).not.toHaveBeenCalled();
  });

  it("stops at one query when the category has no budget", async () => {
    // The usual case. Summing a window for a category nothing limits would put
    // a second query on every expense in the app for no answer.
    await transactionService.create(ctx, "expense", entry);

    expect(budgetFindByCategory).toHaveBeenCalledTimes(1);
    expect(sumBaseAmountByCategory).not.toHaveBeenCalled();
    expect(notifySpace).not.toHaveBeenCalled();
  });
});
