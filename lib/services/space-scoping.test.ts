import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";

/**
 * Space scoping is the tenancy boundary — the thing standing between a private
 * personal ledger and a shared household one. The convention is that services
 * fill `organizationId`, `createdBy`, `updatedBy` and the conversion fields
 * from the {@link SpaceContext}, and callers never supply them.
 *
 * `UserInput<T>` enforces that at compile time. These tests enforce it at
 * runtime, because the compile-time guarantee evaporates the moment anything
 * arrives as `unknown` from a form, a JSON body or a bad cast.
 */

const expenseCreate = vi.fn();
const expenseCreateIfAbsent = vi.fn();
const expenseUpdate = vi.fn();
const expenseFindById = vi.fn();
const budgetCreate = vi.fn();
const budgetFindByCategoryAndPeriod = vi.fn();
const budgetFindByCategory = vi.fn();
const categoryFindById = vi.fn();
const convert = vi.fn();

vi.mock("@/lib/repositories/expense.repository", () => ({
  expenseRepository: {
    create: (...args: unknown[]) => expenseCreate(...args),
    createIfAbsent: (...args: unknown[]) => expenseCreateIfAbsent(...args),
    update: (...args: unknown[]) => expenseUpdate(...args),
    findById: (...args: unknown[]) => expenseFindById(...args),
  },
}));

vi.mock("@/lib/repositories/budget.repository", () => ({
  budgetRepository: {
    create: (...args: unknown[]) => budgetCreate(...args),
    findByCategoryAndPeriod: (...args: unknown[]) => budgetFindByCategoryAndPeriod(...args),
    // Writing a transaction now asks whether it crossed a budget. These tests
    // are about scoping, so the answer is "no budgets" and the overspend path
    // stops there.
    findByCategory: (...args: unknown[]) => budgetFindByCategory(...args),
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

const { expenseService } = await import("@/lib/services/expense.service");
const { budgetService } = await import("@/lib/services/budget.service");
const { transactionService } = await import("@/lib/services/transaction.service");
const { isServiceError } = await import("@/lib/services/errors");

const ctx: SpaceContext = {
  organizationId: "org-mine",
  userId: "user-me",
  baseCurrency: "LKR",
};

const DATE = new Date("2026-08-13T12:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  convert.mockResolvedValue({ baseAmount: "3005.00", rate: "300.50" });
  expenseCreate.mockImplementation(async (row: unknown) => row);
  expenseCreateIfAbsent.mockImplementation(async (row: unknown) => row);
  budgetCreate.mockImplementation(async (row: unknown) => ({ id: 1, ...(row as object) }));
  budgetFindByCategoryAndPeriod.mockResolvedValue(undefined);
  budgetFindByCategory.mockResolvedValue([]);
  categoryFindById.mockResolvedValue({ id: 5, type: "expense", organizationId: "org-mine" });
  expenseUpdate.mockImplementation(async (_id: unknown, _org: unknown, row: unknown) => row);
  expenseFindById.mockResolvedValue({
    id: 1,
    amount: "10.00",
    currency: "USD",
    date: DATE,
    organizationId: "org-mine",
  });
});

describe("an expense is written into the acting user's space", () => {
  it("fills the scope and attribution from the context", async () => {
    await expenseService.createExpense(ctx, {
      amount: "10.00",
      currency: "USD",
      date: DATE,
      categoryId: 5,
      description: "Coffee",
    });

    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-mine",
        createdBy: "user-me",
        updatedBy: "user-me",
      }),
    );
  });

  it("derives the converted amount rather than taking one", async () => {
    // Accepting a converted amount from a client would let it claim any
    // exchange rate it liked.
    await expenseService.createExpense(ctx, {
      amount: "10.00",
      currency: "USD",
      date: DATE,
    });

    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({ baseAmount: "3005.00", exchangeRate: "300.50" }),
    );
  });

  it("converts at the entry's own date, not today", async () => {
    const backdated = new Date("2025-03-04T12:00:00.000Z");

    await expenseService.createExpense(ctx, {
      amount: "10.00",
      currency: "USD",
      date: backdated,
    });

    expect(convert).toHaveBeenCalledWith("10.00", "USD", "LKR", backdated);
  });

  it("defaults a missing currency to the space's own", async () => {
    await expenseService.createExpense(ctx, { amount: "10.00", date: DATE } as never);

    expect(convert).toHaveBeenCalledWith("10.00", "LKR", "LKR", DATE);
  });

  describe("a caller cannot override what the service owns", () => {
    // `UserInput<T>` makes these impossible to type. The cast is the point:
    // this is what an extra field posted to a Server Action would look like
    // after `Object.fromEntries(formData)`.
    const smuggled = {
      amount: "10.00",
      currency: "USD",
      date: DATE,
      organizationId: "org-someone-else",
      createdBy: "user-someone-else",
      updatedBy: "user-someone-else",
      baseAmount: "0.01",
      exchangeRate: "0.000001",
      recurringId: 999,
    } as never;

    it.each([
      ["organizationId", "org-mine"],
      ["createdBy", "user-me"],
      ["updatedBy", "user-me"],
      ["baseAmount", "3005.00"],
      ["exchangeRate", "300.50"],
    ])("overwrites a smuggled %s with %o", async (field, expected) => {
      await expenseService.createExpense(ctx, smuggled);

      expect(expenseCreate).toHaveBeenCalledWith(expect.objectContaining({ [field]: expected }));
    });

    it("ignores a smuggled recurringId, which only the recurring machinery may set", async () => {
      // It is half of the occurrence key, so a caller that could set it could
      // block a real occurrence from ever being created.
      await expenseService.createExpense(ctx, smuggled);

      expect(expenseCreate).toHaveBeenCalledWith(expect.objectContaining({ recurringId: null }));
    });

    it("sets recurringId only when the service passes it as an option", async () => {
      await expenseService.createExpense(
        ctx,
        { amount: "10.00", currency: "USD", date: DATE },
        { recurringId: 42, ifAbsent: true },
      );

      expect(expenseCreateIfAbsent).toHaveBeenCalledWith(
        expect.objectContaining({ recurringId: 42 }),
      );
      expect(expenseCreate).not.toHaveBeenCalled();
    });
  });
});

describe("a budget is scoped to the acting user's space", () => {
  const fields = { categoryId: 5, amount: "1000.00", period: "monthly" as const };

  it("looks the category up within the space, never globally", async () => {
    // A category id from another space must not resolve — otherwise a budget
    // could be attached to it and leak its name onto the page.
    await budgetService.createBudget(ctx, fields);

    expect(categoryFindById).toHaveBeenCalledWith(5, "org-mine");
  });

  it("checks for a clash within the space", async () => {
    await budgetService.createBudget(ctx, fields);

    expect(budgetFindByCategoryAndPeriod).toHaveBeenCalledWith("org-mine", 5, "monthly");
  });

  it("writes the scope and attribution from the context", async () => {
    await budgetService.createBudget(ctx, fields);

    expect(budgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-mine",
        createdBy: "user-me",
        updatedBy: "user-me",
      }),
    );
  });

  it("refuses a category that does not resolve in this space", async () => {
    categoryFindById.mockResolvedValue(undefined);

    await expect(budgetService.createBudget(ctx, fields)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "NOT_FOUND",
    );

    expect(budgetCreate).not.toHaveBeenCalled();
  });

  it("refuses an income category, which the expense pickers never offer", async () => {
    categoryFindById.mockResolvedValue({ id: 5, type: "income", organizationId: "org-mine" });

    await expect(budgetService.createBudget(ctx, fields)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "VALIDATION_FAILED",
    );

    expect(budgetCreate).not.toHaveBeenCalled();
  });

  it("derives startDate from the clock rather than taking one", async () => {
    // A client-supplied start would be a way to backdate a limit over spending
    // that already happened.
    await budgetService.createBudget(ctx, {
      ...fields,
      startDate: new Date("2020-01-01T00:00:00Z"),
    } as never);

    const [row] = budgetCreate.mock.calls[0] as [{ startDate: Date }];

    expect(row.startDate.getUTCFullYear()).toBeGreaterThan(2020);
    expect(row.startDate.getUTCDate()).toBe(1);
    expect(row.startDate.getUTCHours()).toBe(12);
  });
});

describe("a transaction may only file under a category of its own space", () => {
  // The foreign key behind `expenses.categoryId` enforces that the row exists,
  // in any space. Ownership is nobody's job but this one's — without it an
  // entry here can point at another space's category, and the list joins by id,
  // so that category's name renders to people who were never in it.
  const entry = { amount: "10.00", currency: "USD", date: DATE, categoryId: 5 };

  it("looks the category up within the space, never globally", async () => {
    await transactionService.create(ctx, "expense", entry);

    expect(categoryFindById).toHaveBeenCalledWith(5, "org-mine");
  });

  it("refuses an id that does not resolve in this space, and writes nothing", async () => {
    // What a category id belonging to somebody else's space looks like from
    // here: absent. Also what a deleted one looks like.
    categoryFindById.mockResolvedValue(undefined);

    await expect(transactionService.create(ctx, "expense", entry)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "NOT_FOUND",
    );

    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it("refuses an income category on an expense", async () => {
    categoryFindById.mockResolvedValue({ id: 5, type: "income", organizationId: "org-mine" });

    await expect(transactionService.create(ctx, "expense", entry)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "VALIDATION_FAILED",
    );

    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it("accepts an uncategorised entry without a lookup", async () => {
    await transactionService.create(ctx, "expense", { ...entry, categoryId: null });

    expect(categoryFindById).not.toHaveBeenCalled();
    expect(expenseCreate).toHaveBeenCalled();
  });

  it("checks the category on an edit too", async () => {
    categoryFindById.mockResolvedValue(undefined);

    await expect(transactionService.update(ctx, "expense", 1, { categoryId: 5 })).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "NOT_FOUND",
    );

    expect(expenseUpdate).not.toHaveBeenCalled();
  });

  it("leaves the category alone on an edit that does not mention it", async () => {
    await transactionService.update(ctx, "expense", 1, { description: "Renamed" });

    expect(categoryFindById).not.toHaveBeenCalled();
    expect(expenseUpdate).toHaveBeenCalled();
  });

  it("does not re-check a materialised occurrence", async () => {
    // The template's category was checked when the template was saved, and
    // `deleteCategory` refuses while a template still points at it. A catch-up
    // run writes up to sixty entries in one page render; a lookup each would be
    // a query per entry for an answer that cannot have changed.
    await transactionService.create(ctx, "expense", entry, { recurringId: 42, ifAbsent: true });

    expect(categoryFindById).not.toHaveBeenCalled();
    expect(expenseCreateIfAbsent).toHaveBeenCalled();
  });
});
