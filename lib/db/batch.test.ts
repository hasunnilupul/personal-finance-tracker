import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The batch helper is the shared answer to multi-step writes on a driver with
 * no interactive transactions. It is three small functions, but the whole
 * atomicity guarantee is routed through them, so the edges are worth pinning:
 * an empty batch must not be sent, and the null-filtering must not quietly drop
 * a real statement.
 */

const batch = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    batch: (...args: unknown[]) => batch(...args),
  },
}));

const { rowsReturned, runBatch, statements } = await import("@/lib/db/batch");

// Statements are opaque to the helper — it only ever passes them through — so
// stand-ins are enough here.
const A = { statement: "a" } as never;
const B = { statement: "b" } as never;

beforeEach(() => {
  vi.resetAllMocks();
  batch.mockResolvedValue([]);
});

describe("runBatch", () => {
  it("sends every statement in one call, so they share a transaction", async () => {
    await runBatch([A, B]);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith([A, B]);
  });

  it("preserves order, because the response is read positionally", async () => {
    await runBatch([B, A]);

    expect(batch.mock.calls[0][0]).toEqual([B, A]);
  });

  it("returns the driver's per-statement results", async () => {
    batch.mockResolvedValue([[{ id: 1 }], []]);

    await expect(runBatch([A, B])).resolves.toEqual([[{ id: 1 }], []]);
  });

  it("does not send an empty batch — the driver rejects one", async () => {
    await expect(runBatch([])).resolves.toEqual([]);

    expect(batch).not.toHaveBeenCalled();
  });
});

describe("statements", () => {
  it("drops the slots a caller had nothing to write for", () => {
    expect(statements(A, null, B, null)).toEqual([A, B]);
  });

  it("keeps every non-null statement, in order", () => {
    expect(statements(B, A)).toEqual([B, A]);
  });

  it("collapses to empty when there is nothing to write at all", () => {
    expect(statements(null, null)).toEqual([]);
  });
});

describe("rowsReturned", () => {
  it("counts the rows a returning clause produced", () => {
    expect(rowsReturned([{ id: 1 }, { id: 2 }])).toBe(2);
  });

  it("reports zero for a statement that returned nothing", () => {
    expect(rowsReturned([])).toBe(0);
  });

  it("reports zero rather than throwing for a statement with no returning clause", () => {
    expect(rowsReturned(undefined)).toBe(0);
    expect(rowsReturned({ rowCount: 3 })).toBe(0);
  });
});
