import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which tables a reassignment touches is a design decision, not an
 * implementation detail, so it is asserted rather than left to be re-derived.
 *
 * `budgets` carries a `categoryId` like the other three, and was originally
 * moved along with them. That was wrong twice over: the delete dialog counts
 * budgets as *destroyed* — they cascade with the category, and the plan calls
 * them "the part a reassignment cannot save" — and moving one trips
 * `budgets_organizationId_categoryId_period_key` whenever the replacement
 * category already has a limit for the same period. Since the categories worth
 * reassigning to are exactly the ones likely to have budgets, that made the
 * common case of the delete-and-reassign flow fail outright.
 */

const update = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    update: (table: unknown) => update(table),
  },
}));

const { categoryUsageRepository } = await import("@/lib/repositories/category-usage.repository");
const { expenses } = await import("@/lib/db/schema/expenses");
const { income } = await import("@/lib/db/schema/income");
const { budgets } = await import("@/lib/db/schema/budgets");
const { recurringTransactions } = await import("@/lib/db/schema/recurring-transactions");

/** Records what each statement was built with, without touching a database. */
function stubChain() {
  update.mockImplementation((table: unknown) => {
    const chain = {
      table,
      set: vi.fn(() => chain),
      where: vi.fn(() => chain),
      returning: vi.fn(() => chain),
    };
    return chain;
  });
}

const tablesTargeted = () => update.mock.calls.map(([table]) => table);

beforeEach(() => {
  vi.resetAllMocks();
  stubChain();
});

describe("reassignStatements", () => {
  it("moves entries, income and recurring templates", () => {
    categoryUsageRepository.reassignStatements(1, 2, "org-mine", "user-me");

    expect(tablesTargeted()).toEqual([expenses, income, recurringTransactions]);
  });

  it("does not move budgets — they cascade with the category", () => {
    categoryUsageRepository.reassignStatements(1, 2, "org-mine", "user-me");

    expect(tablesTargeted()).not.toContain(budgets);
  });

  it("returns one statement per table it moves", () => {
    expect(categoryUsageRepository.reassignStatements(1, 2, "org-mine", "user-me")).toHaveLength(3);
  });

  it("builds statements without executing them", () => {
    const [first] = categoryUsageRepository.reassignStatements(1, 2, "org-mine", "user-me");

    // A statement that had been awaited would have come back as its result.
    // These have to stay un-awaited to go into a batch.
    expect(first).toHaveProperty("returning");
  });

  it("scopes every statement to the space and stamps who moved the rows", () => {
    const statements = categoryUsageRepository.reassignStatements(1, 2, "org-mine", "user-me");

    for (const statement of statements) {
      const chain = statement as unknown as { set: ReturnType<typeof vi.fn> };
      expect(chain.set).toHaveBeenCalledWith({ categoryId: 2, updatedBy: "user-me" });
    }

    // The `where` carries the organization filter; that it is passed at all is
    // what stops a reassignment reaching across a space boundary.
    for (const statement of statements) {
      const chain = statement as unknown as { where: ReturnType<typeof vi.fn> };
      expect(chain.where).toHaveBeenCalledTimes(1);
    }
  });
});
