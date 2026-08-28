/**
 * Expenses and income are structurally identical — same columns, same rules,
 * opposite sign in a report. The UI and the action layer treat them as one
 * concept keyed by this, so there is one list, one form and one set of
 * actions rather than two of each.
 *
 * They are no longer interchangeable about *where* they may be recorded:
 * income belongs to a personal space and nowhere else. See
 * `TransactionService.assertKindAllowed`.
 */
export type TransactionKind = "expense" | "income";

/**
 * A transaction as the list renders it: the row plus the names it references.
 */
export interface TransactionListItem {
  id: number;
  amount: string;
  currency: string;
  baseAmount: string;
  exchangeRate: string;
  description: string | null;
  date: Date;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  createdBy: string | null;
  createdByName: string | null;
  /**
   * The space the entry is filed in.
   *
   * Usually the space being looked at, and worth carrying anyway: a personal
   * ledger lists its owner's shared-space spending alongside its own, and
   * those rows belong to somebody else's page. Comparing this against the
   * active space is what tells a row apart from the ones it sits with — it is
   * shown with the space's name, and it cannot be edited from here.
   */
  organizationId: string;
  spaceName: string | null;
  updatedAt: Date;
}

/**
 * What the list was asked for, and what came back.
 */
export interface TransactionPage {
  items: TransactionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Narrowing filters for a transaction list.
 *
 * All optional — an absent filter means "no restriction". Dates are
 * `YYYY-MM-DD` strings because they arrive from the URL.
 */
export interface TransactionFilters {
  from?: string;
  to?: string;
  categoryId?: number;
  createdBy?: string;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 25;
