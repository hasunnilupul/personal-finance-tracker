import { and, asc, count, desc, eq, gte, lte, sql, SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import { categories } from "@/lib/db/schema/categories";
import { user } from "@/lib/db/schema/better-auth";
import {
  DEFAULT_PAGE_SIZE,
  TransactionFilters,
  TransactionListItem,
  TransactionPage,
} from "@/lib/db/models/transaction.model";

/**
 * The two tables this works over.
 *
 * Expenses and income have identical columns, so the list query is written
 * once and pointed at whichever table is being read. Duplicating it would mean
 * fixing every future filter twice.
 */
export type TransactionTable = typeof expenses | typeof income;

/**
 * Date-range bounds, in UTC.
 *
 * A transaction date is a calendar day, not an instant, but it is stored in a
 * `timestamp` column. Everything that writes one anchors it to **midday UTC**
 * so the stored instant lands on the intended day in every timezone within
 * ±12h — anchoring to midnight would put an entry made in Colombo on the
 * previous UTC day and quietly drop it out of a range that should contain it.
 *
 * These bounds are the matching read side: the whole UTC day, which contains
 * that midday anchor and nothing from a neighbouring day.
 */
function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}

function buildConditions(
  table: TransactionTable,
  organizationId: string,
  filters: TransactionFilters,
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(table.organizationId, organizationId)];

  if (filters.from) {
    conditions.push(gte(table.date, startOfDay(filters.from)));
  }

  if (filters.to) {
    conditions.push(lte(table.date, endOfDay(filters.to)));
  }

  if (filters.categoryId !== undefined) {
    conditions.push(eq(table.categoryId, filters.categoryId));
  }

  if (filters.createdBy) {
    conditions.push(eq(table.createdBy, filters.createdBy));
  }

  return and(...conditions);
}

/**
 * Reads one page of transactions with the names needed to display them.
 *
 * Always scoped by `organizationId` — the filters narrow within a space, they
 * never widen beyond it.
 */
export async function findTransactionPage(
  table: TransactionTable,
  organizationId: string,
  filters: TransactionFilters = {},
): Promise<TransactionPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const where = buildConditions(table, organizationId, filters);

  const [items, [totals]] = await Promise.all([
    db
      .select({
        id: table.id,
        amount: table.amount,
        currency: table.currency,
        baseAmount: table.baseAmount,
        exchangeRate: table.exchangeRate,
        description: table.description,
        date: table.date,
        categoryId: table.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        createdBy: table.createdBy,
        createdByName: user.name,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .leftJoin(categories, eq(table.categoryId, categories.id))
      .leftJoin(user, eq(table.createdBy, user.id))
      .where(where)
      .orderBy(desc(table.date), desc(table.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(table).where(where),
  ]);

  return {
    items: items as TransactionListItem[],
    total: totals?.value ?? 0,
    page,
    pageSize,
  };
}

/**
 * Sum of a filtered set, in the space's base currency.
 *
 * Sums `baseAmount` rather than `amount` — the amounts may be in several
 * currencies, and only the converted figure is comparable.
 */
export async function sumTransactions(
  table: TransactionTable,
  organizationId: string,
  filters: TransactionFilters = {},
): Promise<string> {
  const [row] = await db
    .select({ total: sumBaseAmount(table) })
    .from(table)
    .where(buildConditions(table, organizationId, filters));

  return row?.total ?? "0.00";
}

function sumBaseAmount(table: TransactionTable) {
  // COALESCE so an empty set reads as zero rather than null.
  return sql<string>`coalesce(sum(${table.baseAmount}), 0)::text`;
}

/**
 * Members who have recorded at least one transaction, for the author filter.
 */
export async function listTransactionAuthors(
  table: TransactionTable,
  organizationId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .selectDistinct({ id: user.id, name: user.name })
    .from(table)
    .innerJoin(user, eq(table.createdBy, user.id))
    .where(eq(table.organizationId, organizationId))
    .orderBy(asc(user.name));

  return rows;
}
