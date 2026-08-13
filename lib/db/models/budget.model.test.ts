import { describe, expect, it } from "vitest";

import { BUDGET_NEAR_THRESHOLD, toBudgetState } from "@/lib/db/models/budget.model";

/**
 * One rule drives both the per-budget rows and the section totals, so a page
 * can never show every row green under a red total. That makes the edges worth
 * pinning precisely.
 */
describe("toBudgetState", () => {
  it("is under while comfortably below the limit", () => {
    expect(toBudgetState(1000, 0)).toBe("under");
    expect(toBudgetState(1000, 500)).toBe("under");
  });

  it("turns near at the threshold, not after it", () => {
    expect(toBudgetState(1000, 1000 * BUDGET_NEAR_THRESHOLD)).toBe("near");
    expect(toBudgetState(1000, 1000 * BUDGET_NEAR_THRESHOLD - 0.01)).toBe("under");
  });

  it("stays near right up to the limit", () => {
    // Spending exactly the limit is not over it — the point of the warning is
    // to fire before the fact.
    expect(toBudgetState(1000, 999.99)).toBe("near");
    expect(toBudgetState(1000, 1000)).toBe("near");
  });

  it("turns over only past the limit", () => {
    expect(toBudgetState(1000, 1000.01)).toBe("over");
    expect(toBudgetState(1000, 5000)).toBe("over");
  });

  describe("a limit of zero", () => {
    // Validation refuses one, but an old row could hold it, and dividing by it
    // would put NaN into a bar's width.
    it.each([0, -100])("reads as under rather than dividing by %o", (limit) => {
      expect(toBudgetState(limit, 500)).toBe("under");
    });
  });
});
