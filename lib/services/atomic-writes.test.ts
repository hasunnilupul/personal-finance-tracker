import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";

/**
 * Two operations in this codebase touch several tables at once: changing a
 * space's base currency, and deleting a category that other rows still point
 * at. Both used to run as independent statements, so a failure part-way left
 * the space in a state nothing on screen could explain — a mix of old- and
 * new-currency amounts under an already-switched currency, or rows moved off a
 * category that then survived.
 *
 * Both now go through one `runBatch`, which is one transaction. What these
 * tests pin is the property that makes that true, and which a later refactor
 * could quietly lose:
 *
 * - **One batch, not several.** Two batches are two transactions, which is the
 *   original bug wearing the new API.
 * - **Nothing written before everything is computed.** The batch cannot read a
 *   result and decide what to write next, so every rate lookup and every
 *   refusal has to happen before it opens. A rate that cannot be found, or a
 *   rule that says no, must leave `runBatch` uncalled.
 *
 * Repositories are mocked at the module boundary as everywhere else, so the
 * services and the statement composition are the real thing.
 */

const runBatch = vi.fn();

const expenseFindAll = vi.fn();
const incomeFindAll = vi.fn();
const budgetFindAll = vi.fn();
const budgetReconvertStatement = vi.fn();
const updateBaseCurrencyStatement = vi.fn();
const reconvertEntriesStatement = vi.fn();
const convert = vi.fn();

const categoryFindById = vi.fn();
const categoryDeleteStatement = vi.fn();
const usageCount = vi.fn();
const reassignStatements = vi.fn();

vi.mock("@/lib/db/batch", async (importOriginal) => ({
  // `statements` and `rowsReturned` are pure and covered in batch.test.ts —
  // only the write itself is stubbed.
  ...(await importOriginal<typeof import("@/lib/db/batch")>()),
  runBatch: (...args: unknown[]) => runBatch(...args),
}));

vi.mock("@/lib/repositories/expense.repository", () => ({
  expenseRepository: { findAll: (...args: unknown[]) => expenseFindAll(...args) },
}));

vi.mock("@/lib/repositories/income.repository", () => ({
  incomeRepository: { findAll: (...args: unknown[]) => incomeFindAll(...args) },
}));

vi.mock("@/lib/repositories/budget.repository", () => ({
  budgetRepository: {
    findAll: (...args: unknown[]) => budgetFindAll(...args),
    reconvertStatement: (...args: unknown[]) => budgetReconvertStatement(...args),
  },
}));

vi.mock("@/lib/repositories/space.repository", () => ({
  spaceRepository: {
    updateBaseCurrencyStatement: (...args: unknown[]) => updateBaseCurrencyStatement(...args),
  },
}));

vi.mock("@/lib/repositories/transaction-query", () => ({
  reconvertEntriesStatement: (...args: unknown[]) => reconvertEntriesStatement(...args),
  sumBaseAmountByCategory: vi.fn(),
}));

vi.mock("@/lib/services/exchange-rate.service", () => ({
  exchangeRateService: { convert: (...args: unknown[]) => convert(...args) },
}));

vi.mock("@/lib/repositories/category.repository", () => ({
  categoryRepository: {
    findById: (...args: unknown[]) => categoryFindById(...args),
    deleteStatement: (...args: unknown[]) => categoryDeleteStatement(...args),
  },
}));

vi.mock("@/lib/repositories/category-usage.repository", () => ({
  EMPTY_USAGE: {
    expenses: 0,
    income: 0,
    recurring: 0,
    budgets: 0,
    reassignable: 0,
    destroyed: 0,
  },
  categoryUsageRepository: {
    count: (...args: unknown[]) => usageCount(...args),
    reassignStatements: (...args: unknown[]) => reassignStatements(...args),
  },
}));

const { spaceService } = await import("@/lib/services/space.service");
const { categoryService } = await import("@/lib/services/category.service");
const { isServiceError } = await import("@/lib/services/errors");

const ctx: SpaceContext = {
  organizationId: "org-mine",
  userId: "user-me",
  baseCurrency: "LKR",
};

const DATE = new Date("2026-08-13T12:00:00.000Z");

/** Statement stand-ins, so the batch's contents can be identified by value. */
const SWITCH = { statement: "switch" };
const EXPENSE_UPDATE = { statement: "expenses" };
const INCOME_UPDATE = { statement: "income" };
const BUDGET_UPDATE = { statement: "budgets" };
const DELETE_CATEGORY = { statement: "delete-category" };

const usage = (parts: Partial<{ reassignable: number; destroyed: number }> = {}) => ({
  expenses: 0,
  income: 0,
  recurring: 0,
  budgets: 0,
  reassignable: 0,
  destroyed: 0,
  ...parts,
});

beforeEach(() => {
  vi.resetAllMocks();

  runBatch.mockResolvedValue([]);
  convert.mockResolvedValue({ baseAmount: "10.00", rate: "0.033" });

  expenseFindAll.mockResolvedValue([{ id: 1, amount: "3000.00", currency: "LKR", date: DATE }]);
  incomeFindAll.mockResolvedValue([{ id: 2, amount: "6000.00", currency: "LKR", date: DATE }]);
  budgetFindAll.mockResolvedValue([{ id: 3, amount: "500.00" }]);

  updateBaseCurrencyStatement.mockReturnValue(SWITCH);
  budgetReconvertStatement.mockReturnValue(BUDGET_UPDATE);
});

describe("changeBaseCurrency", () => {
  beforeEach(() => {
    // Distinguishable per table, so the batch's contents can be asserted.
    let call = 0;
    reconvertEntriesStatement.mockImplementation(() =>
      call++ === 0 ? EXPENSE_UPDATE : INCOME_UPDATE,
    );
  });

  it("writes the currency switch and every re-converted amount in one batch", async () => {
    await spaceService.changeBaseCurrency(ctx, "USD");

    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(runBatch).toHaveBeenCalledWith([SWITCH, EXPENSE_UPDATE, INCOME_UPDATE, BUDGET_UPDATE]);
  });

  it("puts the switch in the same batch as the amounts, never on its own", async () => {
    await spaceService.changeBaseCurrency(ctx, "USD");

    // The original bug: the space's currency was switched by a statement of its
    // own, so a later failure left it pointing at a currency its rows were not
    // in. If the switch ever leaves this list, that is back.
    expect(runBatch.mock.calls[0][0]).toContain(SWITCH);
    expect(runBatch.mock.calls[0][0].length).toBeGreaterThan(1);
  });

  it("reports what it re-converted", async () => {
    await expect(spaceService.changeBaseCurrency(ctx, "USD")).resolves.toEqual({
      entries: 2,
      budgets: 1,
    });
  });

  it("omits the budget statement when the space has no budgets", async () => {
    budgetFindAll.mockResolvedValue([]);

    const result = await spaceService.changeBaseCurrency(ctx, "USD");

    expect(runBatch).toHaveBeenCalledWith([SWITCH, EXPENSE_UPDATE, INCOME_UPDATE]);
    expect(result.budgets).toBe(0);
    expect(budgetReconvertStatement).not.toHaveBeenCalled();
  });

  it("still switches the currency for a space with nothing in it", async () => {
    expenseFindAll.mockResolvedValue([]);
    incomeFindAll.mockResolvedValue([]);
    budgetFindAll.mockResolvedValue([]);
    reconvertEntriesStatement.mockReturnValue(null);

    await expect(spaceService.changeBaseCurrency(ctx, "USD")).resolves.toEqual({
      entries: 0,
      budgets: 0,
    });

    expect(runBatch).toHaveBeenCalledWith([SWITCH]);
  });

  it("writes nothing at all when a rate cannot be found", async () => {
    convert.mockRejectedValue(new Error("no rate for XYZ on 2026-08-13"));

    await expect(spaceService.changeBaseCurrency(ctx, "XYZ")).rejects.toThrow("no rate");

    // The whole point of computing every conversion first: the space is left on
    // the currency it started on, with every amount still expressed in it.
    expect(runBatch).not.toHaveBeenCalled();
  });

  it("converts entries at their own date and budgets at today's", async () => {
    await spaceService.changeBaseCurrency(ctx, "USD");

    // Entries: the entry's own currency and its own date.
    expect(convert).toHaveBeenCalledWith("3000.00", "LKR", "USD", DATE);
    // Budgets: out of the space's outgoing base currency, with no date.
    expect(convert).toHaveBeenCalledWith("500.00", "LKR", "USD");
  });
});

describe("deleteCategory", () => {
  beforeEach(() => {
    categoryFindById.mockResolvedValue({ id: 3, type: "expense", organizationId: "org-mine" });
    usageCount.mockResolvedValue(usage());
    categoryDeleteStatement.mockReturnValue(DELETE_CATEGORY);
    reassignStatements.mockReturnValue([{ statement: "r0" }, { statement: "r1" }]);
    runBatch.mockResolvedValue([[{ id: 1 }]]);
  });

  it("moves the rows and drops the category in one batch", async () => {
    categoryFindById
      .mockResolvedValueOnce({ id: 3, type: "expense", organizationId: "org-mine" })
      .mockResolvedValueOnce({ id: 4, type: "expense", organizationId: "org-mine" });
    usageCount.mockResolvedValue(usage({ reassignable: 3 }));
    runBatch.mockResolvedValue([[{ id: 1 }, { id: 2 }], [{ id: 5 }], [{ id: 9 }]]);

    const result = await categoryService.deleteCategory(ctx, 3, 4);

    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(runBatch).toHaveBeenCalledWith([
      { statement: "r0" },
      { statement: "r1" },
      DELETE_CATEGORY,
    ]);
    expect(result).toEqual({ deleted: true, moved: 3 });
  });

  it("counts what moved from the batch response, not the advisory usage count", async () => {
    categoryFindById
      .mockResolvedValueOnce({ id: 3, type: "expense", organizationId: "org-mine" })
      .mockResolvedValueOnce({ id: 4, type: "expense", organizationId: "org-mine" });
    // The screen said 99; the write says 2. A count that went stale between
    // render and click must not become the number reported back.
    usageCount.mockResolvedValue(usage({ reassignable: 99 }));
    runBatch.mockResolvedValue([[{ id: 1 }, { id: 2 }], [], [{ id: 9 }]]);

    const result = await categoryService.deleteCategory(ctx, 3, 4);

    expect(result.moved).toBe(2);
  });

  it("deletes an unused category with no reassignment in the batch", async () => {
    runBatch.mockResolvedValue([[{ id: 3 }]]);

    const result = await categoryService.deleteCategory(ctx, 3);

    expect(runBatch).toHaveBeenCalledWith([DELETE_CATEGORY]);
    expect(reassignStatements).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true, moved: 0 });
  });

  it("reports not deleted when the row was already gone", async () => {
    runBatch.mockResolvedValue([[]]);

    await expect(categoryService.deleteCategory(ctx, 3)).resolves.toEqual({
      deleted: false,
      moved: 0,
    });
  });

  it("refuses a category still in use without writing anything", async () => {
    usageCount.mockResolvedValue(usage({ reassignable: 4 }));

    await expect(categoryService.deleteCategory(ctx, 3)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "CATEGORY_IN_USE",
    );

    expect(runBatch).not.toHaveBeenCalled();
  });

  it("refuses a reassignment across category types without writing anything", async () => {
    categoryFindById
      .mockResolvedValueOnce({ id: 3, type: "expense", organizationId: "org-mine" })
      .mockResolvedValueOnce({ id: 4, type: "income", organizationId: "org-mine" });

    await expect(categoryService.deleteCategory(ctx, 3, 4)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "VALIDATION_FAILED",
    );

    expect(runBatch).not.toHaveBeenCalled();
  });

  it("refuses reassigning a category to itself without writing anything", async () => {
    await expect(categoryService.deleteCategory(ctx, 3, 3)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "VALIDATION_FAILED",
    );

    expect(runBatch).not.toHaveBeenCalled();
  });

  it("refuses a missing replacement without writing anything", async () => {
    categoryFindById
      .mockResolvedValueOnce({ id: 3, type: "expense", organizationId: "org-mine" })
      .mockResolvedValueOnce(undefined);

    await expect(categoryService.deleteCategory(ctx, 3, 4)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "NOT_FOUND",
    );

    expect(runBatch).not.toHaveBeenCalled();
  });

  it("refuses a missing category without writing anything", async () => {
    categoryFindById.mockResolvedValue(undefined);

    await expect(categoryService.deleteCategory(ctx, 3)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "NOT_FOUND",
    );

    expect(runBatch).not.toHaveBeenCalled();
  });

  it("scopes both the reassignment and the delete to the caller's space", async () => {
    categoryFindById
      .mockResolvedValueOnce({ id: 3, type: "expense", organizationId: "org-mine" })
      .mockResolvedValueOnce({ id: 4, type: "expense", organizationId: "org-mine" });

    await categoryService.deleteCategory(ctx, 3, 4);

    expect(reassignStatements).toHaveBeenCalledWith(3, 4, "org-mine", "user-me");
    expect(categoryDeleteStatement).toHaveBeenCalledWith(3, "org-mine");
  });
});
