import { parseAmount } from "@/lib/currency/format";
import type { Category } from "@/lib/db/models/category.model";
import type {
  SavingsLiquidity,
  TransactionFilters,
  TransactionKind,
  TransactionListItem,
} from "@/lib/db/models/transaction.model";

/**
 * Working out what a transaction list will look like once a write lands, so the
 * page can show it before the server says so.
 *
 * **The whole discipline here is knowing when not to guess.** A wrong optimistic
 * row is worse than a slow one: it shows a figure the server never agreed to, or
 * a row that belongs on another page. Every function below returns `null` the
 * moment it cannot be sure, and `null` means "do what happened before this
 * existed — wait for the server". Nothing in here is allowed to be approximately
 * right.
 *
 * The things the client genuinely cannot know, and that make most of the `null`s:
 *
 * - **Converted amounts.** A foreign-currency entry is converted with a rate the
 *   server looks up for the entry's date. Only an entry already in the space's
 *   base currency has a figure the client can state.
 * - **Which page a row lands on.** The list is a window onto a longer ordering.
 * - **Whether a row matches a search or an author filter.** Search is `ILIKE` on
 *   the database; reproducing it here would be a second implementation to keep in
 *   step, for a case that is rare while typing into a form.
 */

/** What the form posts, parsed and normalised the way the server action does. */
export interface Draft {
  /** Positive and normalised: `"12.30"`. The sign comes from {@link Draft.direction}. */
  amount: string;
  /** Savings only. `"add"` for everything else. */
  direction: "add" | "withdraw";
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  categoryId: number | null;
  description: string | null;
  /** Savings only; ignored elsewhere. */
  liquidity: SavingsLiquidity;
}

export type Change =
  | { type: "delete"; id: number }
  /** `tempId` is negative, so it can never collide with a real row's id. */
  | { type: "create"; tempId: number; draft: Draft }
  | { type: "update"; id: number; draft: Draft };

/** The part of a page a write can change: its rows, its total and its count. */
export interface OptimisticView {
  items: TransactionListItem[];
  /** The filtered total, in the space's base currency, as the page prints it. */
  total: string;
  /** Entries matching the filters across every page. */
  count: number;
  page: number;
  pageSize: number;
}

export interface ChangeContext {
  kind: TransactionKind;
  baseCurrency: string;
  /** The space the page is scoped to; new rows are filed in it. */
  activeSpaceId: string;
  categories: Category[];
  filters: Pick<TransactionFilters, "from" | "to" | "categoryId" | "createdBy" | "search">;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads the form the way `createTransactionAction` does.
 *
 * Mirrors the server's own parsing for the fields that can fail — the amount, the
 * date, the note's length — so that a form which passes here cannot come back
 * with a field error. If anything is off this returns `null` and the form takes
 * the ordinary path, where the server explains what is wrong next to the field.
 */
export function parseDraft(formData: FormData): Draft | null {
  const amount = parseAmount(String(formData.get("amount") ?? ""));

  if (!amount) {
    return null;
  }

  const currency = String(formData.get("currency") ?? "");

  if (!/^[A-Z]{3}$/.test(currency)) {
    return null;
  }

  const date = String(formData.get("date") ?? "");
  const parsedDate = new Date(`${date}T12:00:00.000Z`);

  if (!DATE.test(date) || Number.isNaN(parsedDate.getTime()) || ymd(parsedDate) !== date) {
    return null;
  }

  const rawCategory = formData.get("categoryId");
  const categoryId = rawCategory && rawCategory !== "none" ? Number(rawCategory) : null;

  if (categoryId !== null && !Number.isInteger(categoryId)) {
    return null;
  }

  const description = String(formData.get("description") ?? "").trim();

  if (description.length > 255) {
    return null;
  }

  return {
    amount,
    direction: formData.get("direction") === "withdraw" ? "withdraw" : "add",
    currency,
    date,
    categoryId,
    description: description || null,
    liquidity: formData.get("liquidity") === "locked" ? "locked" : "liquid",
  };
}

/**
 * The view after `change`, or `null` when it cannot be known.
 *
 * Never mutates its input.
 */
export function applyChange(
  view: OptimisticView,
  change: Change,
  context: ChangeContext,
): OptimisticView | null {
  switch (change.type) {
    case "delete":
      return applyDelete(view, change.id);
    case "create":
      return applyCreate(view, change.tempId, change.draft, context);
    case "update":
      return applyUpdate(view, change.id, change.draft, context);
  }
}

function applyDelete(view: OptimisticView, id: number): OptimisticView | null {
  const removed = view.items.find((item) => item.id === id);

  if (!removed) {
    return null;
  }

  return {
    ...view,
    items: view.items.filter((item) => item.id !== id),
    total: addCents(view.total, -toCents(removed.baseAmount)),
    count: Math.max(0, view.count - 1),
  };
}

function applyCreate(
  view: OptimisticView,
  tempId: number,
  draft: Draft,
  context: ChangeContext,
): OptimisticView | null {
  // Foreign currency: the converted figure is the server's to work out.
  if (draft.currency !== context.baseCurrency) {
    return null;
  }

  // Cannot say whether it matches a search, and the author it will carry is not
  // known here, so an author filter cannot be evaluated either.
  if (context.filters.search || context.filters.createdBy) {
    return null;
  }

  // On any later page the new row would land somewhere this page does not show.
  if (view.page !== 1) {
    return null;
  }

  // Outside what the page is showing: nothing visible changes. That is a known
  // answer, not an unknown one — the server will file it, and this list is right
  // to leave it out.
  if (!fits(draft.date, draft.categoryId, context.filters)) {
    return view;
  }

  const row = buildRow(tempId, draft, context);
  const at = positionFor(view.items, row);

  const total = addCents(view.total, toCents(row.baseAmount));
  const count = view.count + 1;

  // Sorts after everything on a full page: it belongs to a later page.
  if (at === view.items.length && view.items.length >= view.pageSize) {
    return { ...view, total, count };
  }

  const items = [...view.items.slice(0, at), row, ...view.items.slice(at)];

  // Pushed the last row off the page.
  if (items.length > view.pageSize) {
    items.pop();
  }

  return { ...view, items, total, count };
}

function applyUpdate(
  view: OptimisticView,
  id: number,
  draft: Draft,
  context: ChangeContext,
): OptimisticView | null {
  const existing = view.items.find((item) => item.id === id);

  if (!existing || context.filters.search) {
    return null;
  }

  const amount = signed(draft);
  const dateChanged = ymd(existing.date) !== draft.date;
  const foreign = draft.currency !== context.baseCurrency;

  // The server re-converts on every edit — the form always posts the amount,
  // currency and date — with whatever rate it finds for the date. Only when none
  // of the three moved can the old figure be carried over.
  if (
    foreign &&
    (dateChanged || existing.amount !== amount || existing.currency !== draft.currency)
  ) {
    return null;
  }

  const baseAmount = foreign ? existing.baseAmount : amount;
  const exchangeRate = foreign ? existing.exchangeRate : "1.0000000000";

  const category = lookupCategory(draft.categoryId, context);

  const row: TransactionListItem = {
    ...existing,
    amount,
    currency: draft.currency,
    baseAmount,
    exchangeRate,
    description: draft.description,
    date: new Date(`${draft.date}T12:00:00.000Z`),
    categoryId: draft.categoryId,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    categoryColor: category?.color ?? null,
    liquidity: context.kind === "savings" ? draft.liquidity : existing.liquidity,
    updatedAt: new Date(),
  };

  const others = view.items.filter((item) => item.id !== id);
  const delta = toCents(baseAmount) - toCents(existing.baseAmount);

  // Edited out of the range or category being shown: it leaves the list.
  if (!fits(draft.date, draft.categoryId, context.filters)) {
    return {
      ...view,
      items: others,
      total: addCents(view.total, -toCents(existing.baseAmount)),
      count: Math.max(0, view.count - 1),
    };
  }

  const items = [...others, row].sort(byDateThenId);
  const at = items.indexOf(row);

  // A new date can carry the row off the page altogether. At either edge that
  // cannot be told from the row staying put, so it is not guessed at.
  if (dateChanged && ((at === 0 && view.page > 1) || (at === items.length - 1 && isFull(view)))) {
    return null;
  }

  return { ...view, items, total: addCents(view.total, delta) };
}

/** Whether a row with this date and category is among those being listed. */
function fits(date: string, categoryId: number | null, filters: ChangeContext["filters"]): boolean {
  if (filters.from && date < filters.from) {
    return false;
  }

  if (filters.to && date > filters.to) {
    return false;
  }

  return filters.categoryId === undefined || categoryId === filters.categoryId;
}

/** Newest first, then highest id first — the order the query asks for. */
function byDateThenId(a: TransactionListItem, b: TransactionListItem): number {
  return b.date.getTime() - a.date.getTime() || b.id - a.id;
}

/** Where a new row sorts. A new row has the highest id, so it leads its own day. */
function positionFor(items: TransactionListItem[], row: TransactionListItem): number {
  const at = items.findIndex((item) => item.date.getTime() <= row.date.getTime());

  return at === -1 ? items.length : at;
}

const isFull = (view: OptimisticView) => view.items.length >= view.pageSize;

function buildRow(tempId: number, draft: Draft, context: ChangeContext): TransactionListItem {
  const amount = signed(draft);
  const category = lookupCategory(draft.categoryId, context);

  return {
    id: tempId,
    amount,
    currency: draft.currency,
    // Same currency as the space: nothing to convert.
    baseAmount: amount,
    exchangeRate: "1.0000000000",
    description: draft.description,
    date: new Date(`${draft.date}T12:00:00.000Z`),
    categoryId: draft.categoryId,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    categoryColor: category?.color ?? null,
    liquidity: context.kind === "savings" ? draft.liquidity : null,
    // Not known here, and a missing author is simply not printed.
    createdBy: null,
    createdByName: null,
    organizationId: context.activeSpaceId,
    spaceName: null,
    updatedAt: new Date(),
  };
}

function lookupCategory(categoryId: number | null, context: ChangeContext): Category | undefined {
  // Savings is never categorised, whatever the form held.
  if (context.kind === "savings" || categoryId === null) {
    return undefined;
  }

  return context.categories.find((category) => category.id === categoryId);
}

/** A withdrawal from savings is stored as a negative amount. */
function signed(draft: Draft): string {
  return draft.direction === "withdraw" ? `-${draft.amount}` : draft.amount;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Money is added in whole cents. Summing decimal strings as floats would drift,
// and the total on screen has to equal what the server prints after.
function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}

function addCents(total: string, delta: number): string {
  return ((toCents(total) + delta) / 100).toFixed(2);
}
