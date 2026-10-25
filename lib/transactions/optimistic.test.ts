import { describe, expect, it } from "vitest";

import type { Category } from "@/lib/db/models/category.model";
import type { TransactionListItem } from "@/lib/db/models/transaction.model";
import {
  applyChange,
  type ChangeContext,
  type Draft,
  type OptimisticView,
  parseDraft,
} from "@/lib/transactions/optimistic";

/**
 * What the page shows before the server answers has to be what the server then
 * says, or the screen jumps — or worse, a figure appears that was never real.
 * These pin the cases where the client can be sure, and, as importantly, the ones
 * where it must decline.
 */

const CATEGORIES = [
  { id: 1, name: "Food", icon: "🍔", color: "#f97316" },
  { id: 2, name: "Travel", icon: "🚌", color: "#0ea5e9" },
] as Category[];

const CONTEXT: ChangeContext = {
  kind: "expense",
  baseCurrency: "LKR",
  activeSpaceId: "space-1",
  categories: CATEGORIES,
  filters: { from: "2026-10-01", to: "2026-10-31" },
};

function row(id: number, date: string, baseAmount: string, over = {}): TransactionListItem {
  return {
    id,
    amount: baseAmount,
    currency: "LKR",
    baseAmount,
    exchangeRate: "1.0000000000",
    description: `entry ${id}`,
    date: new Date(`${date}T12:00:00.000Z`),
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    categoryColor: null,
    liquidity: null,
    createdBy: "user-1",
    createdByName: "Me",
    organizationId: "space-1",
    spaceName: "Personal",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

function view(items: TransactionListItem[], over: Partial<OptimisticView> = {}): OptimisticView {
  const sum = items.reduce((total, item) => total + Number(item.baseAmount), 0);

  return {
    items,
    total: sum.toFixed(2),
    count: items.length,
    page: 1,
    pageSize: 25,
    ...over,
  };
}

const draft = (over: Partial<Draft> = {}): Draft => ({
  amount: "50.00",
  direction: "add",
  currency: "LKR",
  date: "2026-10-20",
  categoryId: null,
  description: "lunch",
  liquidity: "liquid",
  ...over,
});

const create = (over: Partial<Draft> = {}) => ({
  type: "create" as const,
  tempId: -1,
  draft: draft(over),
});

describe("parseDraft", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      data.set(key, value);
    }

    return data;
  };

  const valid = { amount: "1,200.50", currency: "LKR", date: "2026-10-20", categoryId: "2" };

  it("reads what the server action would", () => {
    expect(parseDraft(form({ ...valid, description: "  taxi " }))).toEqual({
      amount: "1200.50",
      direction: "add",
      currency: "LKR",
      date: "2026-10-20",
      categoryId: 2,
      description: "taxi",
      liquidity: "liquid",
    });
  });

  it("treats 'none' and an empty note as no category and no note", () => {
    const parsed = parseDraft(form({ ...valid, categoryId: "none", description: "  " }));

    expect(parsed?.categoryId).toBeNull();
    expect(parsed?.description).toBeNull();
  });

  it("reads a savings withdrawal and a locked saving", () => {
    const parsed = parseDraft(form({ ...valid, direction: "withdraw", liquidity: "locked" }));

    expect(parsed?.direction).toBe("withdraw");
    expect(parsed?.liquidity).toBe("locked");
  });

  // Each of these is something the server would send back as a field error. The
  // form must not close on them — declining sends it down the ordinary path.
  it.each([
    ["a missing amount", { ...valid, amount: "" }],
    ["a zero amount", { ...valid, amount: "0" }],
    ["text for an amount", { ...valid, amount: "lots" }],
    ["no date", { ...valid, date: "" }],
    ["a date that does not exist", { ...valid, date: "2026-02-31" }],
    ["a malformed date", { ...valid, date: "20/10/2026" }],
    ["a broken currency", { ...valid, currency: "" }],
    ["a note over 255 characters", { ...valid, description: "x".repeat(256) }],
    ["a category that is not a number", { ...valid, categoryId: "abc" }],
  ])("declines %s", (_name, fields) => {
    expect(parseDraft(form(fields))).toBeNull();
  });
});

describe("deleting", () => {
  it("removes the row and takes its amount off the total and the count", () => {
    const before = view([row(3, "2026-10-20", "100.00"), row(2, "2026-10-10", "40.50")]);

    const after = applyChange(before, { type: "delete", id: 3 }, CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([2]);
    expect(after?.total).toBe("40.50");
    expect(after?.count).toBe(1);
  });

  it("does not mutate the view it was given", () => {
    const before = view([row(3, "2026-10-20", "100.00")]);

    applyChange(before, { type: "delete", id: 3 }, CONTEXT);

    expect(before.items).toHaveLength(1);
    expect(before.total).toBe("100.00");
  });

  it("subtracts a savings withdrawal by adding it back", () => {
    const before = view([row(2, "2026-10-20", "-30.00"), row(1, "2026-10-10", "100.00")]);

    expect(applyChange(before, { type: "delete", id: 2 }, CONTEXT)?.total).toBe("100.00");
  });

  it("declines a row that is not on the page", () => {
    expect(
      applyChange(view([row(1, "2026-10-10", "5.00")]), { type: "delete", id: 99 }, CONTEXT),
    ).toBeNull();
  });

  it("keeps the count from going negative", () => {
    const before = view([row(1, "2026-10-10", "5.00")], { count: 0 });

    expect(applyChange(before, { type: "delete", id: 1 }, CONTEXT)?.count).toBe(0);
  });
});

describe("adding", () => {
  const existing = () => [
    row(5, "2026-10-25", "10.00"),
    row(4, "2026-10-20", "20.00"),
    row(3, "2026-10-10", "30.00"),
  ];

  it("inserts the row at its date, adds to the total, and counts it", () => {
    const after = applyChange(view(existing()), create({ date: "2026-10-15" }), CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([5, 4, -1, 3]);
    expect(after?.total).toBe("110.00");
    expect(after?.count).toBe(4);
  });

  it("puts a new row ahead of others on the same day, as a higher id would sort", () => {
    const after = applyChange(view(existing()), create({ date: "2026-10-20" }), CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([5, -1, 4, 3]);
  });

  it("fills in the category's name, icon and colour from the list it was given", () => {
    const after = applyChange(view(existing()), create({ categoryId: 2 }), CONTEXT);
    const added = after?.items.find((item) => item.id === -1);

    expect(added).toMatchObject({ categoryName: "Travel", categoryIcon: "🚌", categoryId: 2 });
    expect(added?.organizationId).toBe("space-1");
  });

  it("files a savings withdrawal as a negative amount and takes it off the total", () => {
    const context = { ...CONTEXT, kind: "savings" as const };
    const after = applyChange(
      view(existing()),
      create({ direction: "withdraw", categoryId: 2 }),
      context,
    );
    const added = after?.items.find((item) => item.id === -1);

    expect(added?.amount).toBe("-50.00");
    expect(added?.categoryName).toBeNull();
    expect(after?.total).toBe("10.00");
  });

  it("adds in whole cents, so a long run of small sums does not drift", () => {
    let current = view([row(1, "2026-10-01", "0.10")]);

    for (let i = 0; i < 20; i++) {
      current =
        applyChange(current, create({ amount: "0.10", date: "2026-10-02" }), CONTEXT) ?? current;
    }

    expect(current.total).toBe("2.10");
  });

  it("leaves the list alone when the entry falls outside the date range, and says so by not declining", () => {
    const before = view(existing());
    const after = applyChange(before, create({ date: "2026-09-30" }), CONTEXT);

    expect(after).toBe(before);
  });

  it("leaves the list alone when the entry is not in the filtered category", () => {
    const context = { ...CONTEXT, filters: { ...CONTEXT.filters, categoryId: 1 } };
    const before = view(existing());

    expect(applyChange(before, create({ categoryId: 2 }), context)).toBe(before);
    expect(applyChange(before, create({ categoryId: 1 }), context)?.items).toHaveLength(4);
  });

  it("drops the row that no longer fits when the page was full", () => {
    const full = view(existing(), { pageSize: 3 });
    const after = applyChange(full, create({ date: "2026-10-22" }), CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([5, -1, 4]);
    expect(after?.count).toBe(4);
  });

  it("counts a row that sorts past the end of a full page without showing it", () => {
    const full = view(existing(), { pageSize: 3 });
    const after = applyChange(full, create({ date: "2026-10-02" }), CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([5, 4, 3]);
    expect(after?.total).toBe("110.00");
    expect(after?.count).toBe(4);
  });

  describe("declines when it cannot be sure", () => {
    const before = () => view(existing());

    it("for a foreign currency, whose converted amount only the server can state", () => {
      expect(applyChange(before(), create({ currency: "USD" }), CONTEXT)).toBeNull();
    });

    it("for any page but the first", () => {
      expect(applyChange(view(existing(), { page: 2 }), create(), CONTEXT)).toBeNull();
    });

    it("while a search is active", () => {
      const context = { ...CONTEXT, filters: { ...CONTEXT.filters, search: "lunch" } };

      expect(applyChange(before(), create(), context)).toBeNull();
    });

    it("while filtering by author, which a new row's author cannot be checked against", () => {
      const context = { ...CONTEXT, filters: { ...CONTEXT.filters, createdBy: "user-2" } };

      expect(applyChange(before(), create(), context)).toBeNull();
    });
  });
});

describe("editing", () => {
  const items = () => [
    row(3, "2026-10-25", "30.00", { description: "c" }),
    row(2, "2026-10-20", "20.00", { description: "b" }),
    row(1, "2026-10-10", "10.00", { description: "a" }),
  ];
  const update = (id: number, over: Partial<Draft> = {}) => ({
    type: "update" as const,
    id,
    draft: draft({ amount: "20.00", date: "2026-10-20", description: "b", ...over }),
  });

  it("changes the note in place and leaves the total alone", () => {
    const after = applyChange(view(items()), update(2, { description: "bee" }), CONTEXT);

    expect(after?.items.map((item) => item.description)).toEqual(["c", "bee", "a"]);
    expect(after?.total).toBe("60.00");
  });

  it("moves the total by the difference when the amount changes", () => {
    const after = applyChange(view(items()), update(2, { amount: "75.25" }), CONTEXT);

    expect(after?.items[1].baseAmount).toBe("75.25");
    expect(after?.total).toBe("115.25");
  });

  it("re-sorts the page when the date changes", () => {
    const after = applyChange(view(items()), update(2, { date: "2026-10-12" }), CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([3, 2, 1]);

    const earlier = applyChange(view(items()), update(3, { date: "2026-10-15" }), CONTEXT);

    expect(earlier?.items.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("removes the row when its new date is outside the range being shown", () => {
    const after = applyChange(view(items()), update(2, { date: "2026-11-02" }), CONTEXT);

    expect(after?.items.map((item) => item.id)).toEqual([3, 1]);
    expect(after?.total).toBe("40.00");
    expect(after?.count).toBe(2);
  });

  it("removes the row when its new category is not the one being filtered on", () => {
    const context = { ...CONTEXT, filters: { ...CONTEXT.filters, categoryId: 1 } };
    const before = view([row(2, "2026-10-20", "20.00", { categoryId: 1 })]);

    expect(applyChange(before, update(2, { categoryId: 2 }), context)?.items).toHaveLength(0);
  });

  it("carries a foreign amount over when nothing that affects conversion changed", () => {
    const foreign = view([
      row(2, "2026-10-20", "6500.00", { amount: "20.00", currency: "USD", exchangeRate: "325.0" }),
    ]);

    const after = applyChange(
      foreign,
      update(2, { currency: "USD", amount: "20.00", description: "renamed" }),
      CONTEXT,
    );

    expect(after?.items[0]).toMatchObject({ description: "renamed", baseAmount: "6500.00" });
    expect(after?.total).toBe("6500.00");
  });

  describe("declines when it cannot be sure", () => {
    const foreign = () =>
      view([row(2, "2026-10-20", "6500.00", { amount: "20.00", currency: "USD" })]);

    it.each([
      ["the amount", { currency: "USD", amount: "25.00" }],
      ["the date", { currency: "USD", amount: "20.00", date: "2026-10-21" }],
      ["the currency", { currency: "EUR", amount: "20.00" }],
    ])("for a foreign entry whose %s changed, since it would be re-converted", (_name, over) => {
      expect(applyChange(foreign(), update(2, over), CONTEXT)).toBeNull();
    });

    it("while a search is active, since the edit may stop it matching", () => {
      const context = { ...CONTEXT, filters: { ...CONTEXT.filters, search: "b" } };

      expect(applyChange(view(items()), update(2), context)).toBeNull();
    });

    it("for a row that is not on the page", () => {
      expect(applyChange(view(items()), update(99), CONTEXT)).toBeNull();
    });

    it("when a new date lands the row at the end of a full page, where it may belong to the next", () => {
      const full = view(items(), { pageSize: 3 });

      expect(applyChange(full, update(3, { date: "2026-10-02" }), CONTEXT)).toBeNull();
    });

    it("when a new date lands the row first on a page after the first", () => {
      const later = view(items(), { page: 2 });

      expect(applyChange(later, update(1, { date: "2026-10-30" }), CONTEXT)).toBeNull();
    });
  });
});
