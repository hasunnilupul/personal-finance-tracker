import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";

/**
 * A shared space's expenses are its members' own spending, and a personal space
 * is where income lives.
 *
 * Two rules, and they are the two halves of one decision: money spent from a
 * shared space still leaves the pocket of whoever spent it, so their personal
 * ledger has to count it — and income, which is not joint in the first place,
 * is recorded once in the personal space rather than copied into every shared
 * one somebody happens to belong to.
 *
 * Both are enforced in the service layer rather than only in the UI, because
 * the UI is what a Server Action's caller can decline to use. These tests are
 * the refusals; the widened read is asserted through the scope handed to the
 * query layer, which is the whole of what decides which rows come back.
 */

const findTransactionPage = vi.fn();
const sumTransactions = vi.fn();
const expenseCreate = vi.fn();
const expenseUpdate = vi.fn();
const expenseFindById = vi.fn();
const incomeCreate = vi.fn();
const findPersonalSpace = vi.fn();
const categoryFindById = vi.fn();
const categoryCreate = vi.fn();
const categoryCreateMany = vi.fn();
const categoryFindByType = vi.fn();
const convert = vi.fn();

vi.mock("@/lib/repositories/transaction-query", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repositories/transaction-query")>(
    "@/lib/repositories/transaction-query",
  );

  return {
    // The scope builders are the thing under test, so they are the real ones.
    inSpace: actual.inSpace,
    inPersonalLedger: actual.inPersonalLedger,
    findTransactionPage: (...args: unknown[]) => findTransactionPage(...args),
    sumTransactions: (...args: unknown[]) => sumTransactions(...args),
    listTransactionAuthors: vi.fn(),
    sumBaseAmountByCategory: vi.fn(),
    sumByCategoryWithNames: vi.fn(),
    sumByMonth: vi.fn(),
  };
});

vi.mock("@/lib/repositories/expense.repository", () => ({
  expenseRepository: {
    create: (...args: unknown[]) => expenseCreate(...args),
    createIfAbsent: vi.fn(),
    update: (...args: unknown[]) => expenseUpdate(...args),
    findById: (...args: unknown[]) => expenseFindById(...args),
  },
}));

vi.mock("@/lib/repositories/income.repository", () => ({
  incomeRepository: {
    create: (...args: unknown[]) => incomeCreate(...args),
    createIfAbsent: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock("@/lib/repositories/space.repository", () => ({
  spaceRepository: {
    findPersonalSpace: (...args: unknown[]) => findPersonalSpace(...args),
  },
}));

vi.mock("@/lib/repositories/category.repository", () => ({
  categoryRepository: {
    findById: (...args: unknown[]) => categoryFindById(...args),
    create: (...args: unknown[]) => categoryCreate(...args),
    createMany: (...args: unknown[]) => categoryCreateMany(...args),
    findByType: (...args: unknown[]) => categoryFindByType(...args),
  },
}));

vi.mock("@/lib/repositories/category-usage.repository", () => ({
  EMPTY_USAGE: {},
  categoryUsageRepository: { count: vi.fn(), countAll: vi.fn(), reassignStatements: vi.fn() },
}));

vi.mock("@/lib/repositories/budget.repository", () => ({
  budgetRepository: { findByCategory: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/lib/services/exchange-rate.service", () => ({
  exchangeRateService: {
    convert: (...args: unknown[]) => convert(...args),
  },
}));

const { transactionService } = await import("@/lib/services/transaction.service");
const { expenseService } = await import("@/lib/services/expense.service");
const { categoryService } = await import("@/lib/services/category.service");
const { recurringTransactionService } =
  await import("@/lib/services/recurring-transaction.service");
const { isServiceError } = await import("@/lib/services/errors");
const { expenses } = await import("@/lib/db/schema/expenses");
const { income } = await import("@/lib/db/schema/income");

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

const DATE = new Date("2026-08-13T12:00:00.000Z");

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 25 };

beforeEach(() => {
  vi.resetAllMocks();
  findTransactionPage.mockResolvedValue(EMPTY_PAGE);
  sumTransactions.mockResolvedValue("0.00");
  expenseCreate.mockImplementation(async (row: unknown) => row);
  expenseUpdate.mockImplementation(async (_id: unknown, _org: unknown, row: unknown) => row);
  categoryCreate.mockImplementation(async (row: unknown) => row);
  categoryCreateMany.mockImplementation(async (rows: unknown) => rows);
  categoryFindByType.mockResolvedValue([]);
  categoryFindById.mockResolvedValue({ id: 5, type: "expense", organizationId: "org-household" });
  convert.mockResolvedValue({ baseAmount: "3005.00", rate: "300.50" });
  findPersonalSpace.mockResolvedValue({ id: "org-personal", baseCurrency: "LKR" });
});

describe("what a personal ledger reads", () => {
  it("reads expenses across every space its owner belongs to", async () => {
    await transactionService.list(personal, "expense");

    expect(findTransactionPage).toHaveBeenCalledWith(
      expenses,
      { within: "personal-ledger", userId: "user-me" },
      {},
    );
  });

  it("totals expenses the same way, or the total would disagree with the list", async () => {
    await transactionService.total(personal, "expense");

    expect(sumTransactions).toHaveBeenCalledWith(
      expenses,
      { within: "personal-ledger", userId: "user-me" },
      {},
    );
  });

  it("keeps income inside the personal space, which is the only place it exists", async () => {
    await transactionService.list(personal, "income");

    expect(findTransactionPage).toHaveBeenCalledWith(
      income,
      { within: "space", organizationId: "org-personal" },
      {},
    );
  });

  it("does not widen a shared space, whose ledger is the joint one", async () => {
    await transactionService.list(shared, "expense");

    expect(findTransactionPage).toHaveBeenCalledWith(
      expenses,
      { within: "space", organizationId: "org-household" },
      {},
    );
  });
});

describe("what a shared expense costs its creator", () => {
  it("records what it was worth in the creator's own currency", async () => {
    findPersonalSpace.mockResolvedValue({ id: "org-personal", baseCurrency: "USD" });
    convert
      .mockResolvedValueOnce({ baseAmount: "3005.00", rate: "300.50" })
      .mockResolvedValueOnce({ baseAmount: "10.00", rate: "1.00" });

    const created = await expenseService.createExpense(shared, {
      amount: "10.00",
      currency: "USD",
      date: DATE,
    } as never);

    expect(created).toMatchObject({
      baseAmount: "3005.00",
      personalBaseAmount: "10.00",
      personalExchangeRate: "1.00",
    });
  });

  it("reuses the conversion it already did when both spaces report the same currency", async () => {
    const created = await expenseService.createExpense(shared, {
      amount: "10.00",
      currency: "USD",
      date: DATE,
    } as never);

    // One conversion, not two: a second lookup would produce the same figure.
    expect(convert).toHaveBeenCalledTimes(1);
    expect(created).toMatchObject({
      personalBaseAmount: "3005.00",
      personalExchangeRate: "300.50",
    });
  });

  it("leaves it null in a personal space, where baseAmount is already the figure", async () => {
    const created = await expenseService.createExpense(personal, {
      amount: "10.00",
      currency: "USD",
      date: DATE,
    } as never);

    expect(created).toMatchObject({
      personalBaseAmount: null,
      personalExchangeRate: null,
    });
    expect(findPersonalSpace).not.toHaveBeenCalled();
  });

  it("recomputes it when an edit moves the amount", async () => {
    findPersonalSpace.mockResolvedValue({ id: "org-personal", baseCurrency: "USD" });
    expenseFindById.mockResolvedValue({
      id: 1,
      amount: "10.00",
      currency: "USD",
      date: DATE,
    });
    convert
      .mockResolvedValueOnce({ baseAmount: "6010.00", rate: "300.50" })
      .mockResolvedValueOnce({ baseAmount: "20.00", rate: "1.00" });

    const updated = await expenseService.updateExpense(shared, 1, { amount: "20.00" });

    expect(updated).toMatchObject({
      baseAmount: "6010.00",
      personalBaseAmount: "20.00",
    });
  });
});

describe("income belongs to a personal space", () => {
  it("refuses an income entry in a shared space", async () => {
    await expect(
      transactionService.create(shared, "income", {
        amount: "100.00",
        currency: "LKR",
        date: DATE,
      }),
    ).rejects.toSatisfy((error: unknown) => isServiceError(error) && error.code === "FORBIDDEN");

    expect(incomeCreate).not.toHaveBeenCalled();
  });

  it("refuses an edit to one too, so an entry cannot be moved in by editing", async () => {
    await expect(
      transactionService.update(shared, "income", 1, { amount: "100.00" }),
    ).rejects.toSatisfy((error: unknown) => isServiceError(error) && error.code === "FORBIDDEN");
  });

  it("still allows income in a personal space", async () => {
    categoryFindById.mockResolvedValue({ id: 5, type: "income", organizationId: "org-personal" });
    incomeCreate.mockImplementation(async (row: unknown) => row);

    await transactionService.create(personal, "income", {
      amount: "100.00",
      currency: "LKR",
      date: DATE,
      categoryId: 5,
    });

    expect(incomeCreate).toHaveBeenCalled();
  });

  it("refuses an income category in a shared space", async () => {
    await expect(
      categoryService.createCategory(shared, {
        name: "Salary",
        icon: "💵",
        color: "#00ff00",
        type: "income",
      }),
    ).rejects.toSatisfy((error: unknown) => isServiceError(error) && error.code === "FORBIDDEN");

    expect(categoryCreate).not.toHaveBeenCalled();
  });

  it("refuses to add the default income categories to a shared space", async () => {
    await expect(categoryService.addMissingDefaults(shared, "income")).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.code === "FORBIDDEN",
    );
  });

  it("seeds a shared space with expense categories only", async () => {
    const seeded: { type: string }[] = await categoryService.seedDefaultCategories(shared);

    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((category) => category.type === "expense")).toBe(true);
  });

  it("seeds a personal space with both", async () => {
    const seeded: { type: string }[] = await categoryService.seedDefaultCategories(personal);

    expect(seeded.some((category) => category.type === "income")).toBe(true);
    expect(seeded.some((category) => category.type === "expense")).toBe(true);
  });

  it("refuses a recurring income template in a shared space", async () => {
    await expect(
      recurringTransactionService.create(shared, {
        type: "income",
        amount: "100.00",
        currency: "LKR",
        frequency: "monthly",
        startDate: DATE,
        endDate: null,
        categoryId: null,
        description: null,
        isActive: true,
      } as never),
    ).rejects.toSatisfy((error: unknown) => isServiceError(error) && error.code === "FORBIDDEN");
  });
});
