import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpaceContext } from "@/lib/services/types";
import { RecurringTransaction } from "@/lib/db/models/recurring-transaction.model";

const countDue = vi.fn();
const findDue = vi.fn();
const update = vi.fn();
const create = vi.fn();
const transactionCreate = vi.fn();

vi.mock("@/lib/repositories/recurring-transaction.repository", () => ({
  recurringTransactionRepository: {
    countDue: (...args: unknown[]) => countDue(...args),
    findDue: (...args: unknown[]) => findDue(...args),
    update: (...args: unknown[]) => update(...args),
    create: (...args: unknown[]) => create(...args),
  },
}));

vi.mock("@/lib/services/transaction.service", () => ({
  transactionService: {
    create: (...args: unknown[]) => transactionCreate(...args),
  },
}));

vi.mock("@/lib/repositories/category.repository", () => ({
  categoryRepository: { findById: vi.fn() },
}));

vi.mock("@/lib/repositories/space.repository", () => ({
  spaceRepository: { findById: vi.fn() },
}));

const { recurringTransactionService } =
  await import("@/lib/services/recurring-transaction.service");

const ctx: SpaceContext = {
  organizationId: "org",
  userId: "user",
  baseCurrency: "LKR",
};

const NOW = new Date("2026-08-13T06:00:00.000Z");
const on = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function template(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 1,
    categoryId: 5,
    type: "expense",
    amount: "50000.00",
    currency: "LKR",
    description: "Rent",
    frequency: "monthly",
    startDate: on("2026-06-01"),
    nextDate: on("2026-06-01"),
    endDate: null,
    isActive: true,
    organizationId: "org",
    createdBy: "user",
    updatedBy: "user",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  countDue.mockResolvedValue(1);
  update.mockResolvedValue(undefined);
  transactionCreate.mockResolvedValue({ id: 100 });
});

describe("catchUp", () => {
  describe("the guard", () => {
    it("does no work at all when nothing is due", async () => {
      // This runs on every dashboard render, so the common case has to be one
      // indexed count and no reads or writes.
      countDue.mockResolvedValue(0);

      const result = await recurringTransactionService.catchUp(ctx, NOW);

      expect(result).toEqual({ created: 0, templates: 0, more: false });
      expect(findDue).not.toHaveBeenCalled();
      expect(transactionCreate).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it("asks only about this space", async () => {
      countDue.mockResolvedValue(0);

      await recurringTransactionService.catchUp(ctx, NOW);

      expect(countDue).toHaveBeenCalledWith("org", expect.any(Date));
    });
  });

  describe("materialising", () => {
    beforeEach(() => {
      findDue.mockResolvedValue([template()]);
    });

    it("creates one entry per due occurrence", async () => {
      const result = await recurringTransactionService.catchUp(ctx, NOW);

      // 1 June, 1 July, 1 August — 1 September has not arrived.
      expect(transactionCreate).toHaveBeenCalledTimes(3);
      expect(result.created).toBe(3);
    });

    it("writes every entry before advancing nextDate", async () => {
      // The ordering invariant. There are no interactive transactions on this
      // driver, so the two writes cannot be atomic. Advancing first would lose
      // an occurrence outright if the insert then failed — money silently
      // missing. Creating first can at worst repeat, and the occurrence key
      // makes a repeat a no-op.
      await recurringTransactionService.catchUp(ctx, NOW);

      const lastCreate = Math.max(...transactionCreate.mock.invocationCallOrder);
      const firstAdvance = Math.min(...update.mock.invocationCallOrder);

      expect(lastCreate).toBeLessThan(firstAdvance);
    });

    it("always inserts idempotently and stamps the template id", async () => {
      await recurringTransactionService.catchUp(ctx, NOW);

      for (const call of transactionCreate.mock.calls) {
        expect(call[3]).toEqual({ recurringId: 1, ifAbsent: true });
      }
    });

    it("carries the template's own amount, currency and category", async () => {
      await recurringTransactionService.catchUp(ctx, NOW);

      expect(transactionCreate).toHaveBeenCalledWith(
        ctx,
        "expense",
        expect.objectContaining({
          amount: "50000.00",
          currency: "LKR",
          categoryId: 5,
          description: "Rent",
        }),
        expect.anything(),
      );
    });

    it("leaves nextDate on the following occurrence", async () => {
      await recurringTransactionService.catchUp(ctx, NOW);

      expect(update).toHaveBeenCalledWith(
        1,
        "org",
        expect.objectContaining({ nextDate: on("2026-09-01") }),
      );
    });

    it("counts an occurrence that already existed as a success, not a failure", async () => {
      // `createIfAbsent` returns undefined when a previous run got there first.
      // That is the idempotency working, so it must not be counted as created
      // and must not stop the run.
      transactionCreate.mockResolvedValue(undefined);

      const result = await recurringTransactionService.catchUp(ctx, NOW);

      expect(result.created).toBe(0);
      expect(result.templates).toBe(1);
      expect(update).toHaveBeenCalled();
    });
  });

  describe("end dates", () => {
    it("deactivates a template once it is finished", async () => {
      findDue.mockResolvedValue([template({ endDate: on("2026-07-15") })]);

      await recurringTransactionService.catchUp(ctx, NOW);

      expect(transactionCreate).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenCalledWith(1, "org", expect.objectContaining({ isActive: false }));
    });

    it("deactivates a finished template that has nothing left to create", async () => {
      // Otherwise it would be re-read by every catch-up for ever.
      findDue.mockResolvedValue([
        template({ nextDate: on("2026-08-01"), endDate: on("2026-07-15") }),
      ]);

      await recurringTransactionService.catchUp(ctx, NOW);

      expect(transactionCreate).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(1, "org", { isActive: false });
    });
  });

  describe("a long backlog", () => {
    it("reports that more is still to come", async () => {
      // A daily template dormant for two years exceeds the per-run cap, so the
      // caller can say so rather than implying it is finished.
      findDue.mockResolvedValue([
        template({ frequency: "daily", startDate: on("2024-01-01"), nextDate: on("2024-01-01") }),
      ]);

      const result = await recurringTransactionService.catchUp(ctx, NOW);

      expect(result.created).toBe(60);
      expect(result.more).toBe(true);
    });
  });

  it("scopes every write to the acting space", async () => {
    findDue.mockResolvedValue([template()]);

    await recurringTransactionService.catchUp(ctx, NOW);

    for (const call of update.mock.calls) {
      expect(call[1]).toBe("org");
    }
  });
});
