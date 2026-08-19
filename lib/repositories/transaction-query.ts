import { and, asc, count, desc, eq, gte, lte, sql, SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import type { BatchStatement } from "@/lib/db/batch";
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
 * Spend per category between two instants, in the space's base currency.
 *
 * One grouped query for the whole set rather than one sum per caller: the
 * budgets page asks this once per period type and reads every budget's spend
 * out of the result, so a space with thirty budgets costs the same as one with
 * three. Reports will want the same shape.
 *
 * Takes `Date` bounds rather than the `YYYY-MM-DD` strings the filters use,
 * because the callers here derive their range from a calendar period rather
 * than from the URL. The bounds are inclusive on both ends.
 *
 * @returns Totals keyed by category id. Uncategorised spend belongs to no
 * category and is left out.
 */
export async function sumBaseAmountByCategory(
  table: TransactionTable,
  organizationId: string,
  from: Date,
  to: Date,
): Promise<Map<number, string>> {
  const rows = await db
    .select({ categoryId: table.categoryId, total: sumBaseAmount(table) })
    .from(table)
    .where(
      and(eq(table.organizationId, organizationId), gte(table.date, from), lte(table.date, to)),
    )
    .groupBy(table.categoryId);

  const totals = new Map<number, string>();

  for (const row of rows) {
    if (row.categoryId !== null) {
      totals.set(row.categoryId, row.total);
    }
  }

  return totals;
}

/**
 * Spend per category over a filtered set, with the names needed to label it.
 *
 * Unlike `sumBaseAmountByCategory`, this **keeps the uncategorised bucket** as a
 * row with a null `categoryId`. Budgets can ignore it — no limit can point at
 * it — but a report that dropped it would print a breakdown whose parts do not
 * add up to the total beside them.
 *
 * Takes the same `TransactionFilters` the list uses, so a report range and a
 * list filter narrow identically and the figures agree.
 *
 * @returns Rows ordered by total, largest first.
 */
export async function sumByCategoryWithNames(
  table: TransactionTable,
  organizationId: string,
  filters: TransactionFilters = {},
): Promise<
  {
    categoryId: number | null;
    name: string | null;
    icon: string | null;
    color: string | null;
    total: string;
  }[]
> {
  const total = sumBaseAmount(table);

  return db
    .select({
      categoryId: table.categoryId,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      total,
    })
    .from(table)
    .leftJoin(categories, eq(table.categoryId, categories.id))
    .where(buildConditions(table, organizationId, filters))
    .groupBy(table.categoryId, categories.name, categories.icon, categories.color)
    .orderBy(desc(total));
}

/**
 * Totals per calendar month over a filtered set.
 *
 * `to_char` reads the stored value directly — the column is `timestamp without
 * time zone` and every date is written anchored to midday UTC, so the month it
 * reports is the calendar month the entry was filed under, with no timezone
 * conversion in the way.
 *
 * @returns Totals keyed by `YYYY-MM`. Months with no entries are absent; the
 * caller supplies the full axis, because a missing month is a zero, not a gap
 * to be skipped.
 */
export async function sumByMonth(
  table: TransactionTable,
  organizationId: string,
  filters: TransactionFilters = {},
): Promise<Map<string, string>> {
  const month = sql<string>`to_char(${table.date}, 'YYYY-MM')`;

  const rows = await db
    .select({ month, total: sumBaseAmount(table) })
    .from(table)
    .where(buildConditions(table, organizationId, filters))
    .groupBy(month);

  return new Map(rows.map((row) => [row.month, row.total]));
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

/** Where an export left off: the last row it emitted. */
export interface TransactionCursor {
  date: Date;
  id: number;
}

/**
 * One chunk of an export, newest first.
 *
 * **Keyset, not `OFFSET`, and the reason is correctness rather than speed.** An
 * export walks the whole table over several round trips, and an `OFFSET` walk
 * is defined against a result set that is being rewritten underneath it — one
 * entry added while the export runs shifts every later page by one, so a row is
 * silently skipped, and one deleted makes a row appear twice. A cursor on the
 * same `(date, id)` the ordering uses cannot do either: it asks for what comes
 * after a specific row, not for a position.
 *
 * The row-wise comparison is Postgres's, and it is the whole point —
 * `(date, id) < (:date, :id)` is one tuple comparison, so it matches the
 * `ORDER BY` exactly. Written as `date < :date OR (date = :date AND id < :id)`
 * it would mean the same thing and read like it might not.
 *
 * No `count()` here, unlike `findTransactionPage`: an export does not need a
 * total, and paying for one on every chunk is a second full scan per round
 * trip.
 */
export async function findTransactionChunk(
  table: TransactionTable,
  organizationId: string,
  filters: TransactionFilters,
  cursor: TransactionCursor | null,
  limit: number,
): Promise<TransactionListItem[]> {
  const conditions: (SQL | undefined)[] = [buildConditions(table, organizationId, filters)];

  if (cursor) {
    conditions.push(sql`(${table.date}, ${table.id}) < (${cursor.date}, ${cursor.id})`);
  }

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(desc(table.date), desc(table.id))
    .limit(limit);

  return rows as TransactionListItem[];
}

/** One entry's recomputed base-currency figures. */
export interface Reconversion {
  id: number;
  baseAmount: string;
  rate: string;
}

/**
 * Rewrites every entry's `baseAmount` and `exchangeRate` in **one** statement.
 *
 * Used when a space changes its base currency. Each entry converts at its own
 * date and so gets its own figures, which would ordinarily mean one `UPDATE`
 * per row; a space with a few years of history would then be a few thousand
 * statements, and putting those in one batch would mean one enormous request.
 * Joining against an inline `VALUES` list collapses them into a single
 * statement whose size grows with rows rather than round trips.
 *
 * The casts on the first tuple are what give the `VALUES` list its column
 * types — Postgres infers them from the first row, and an uncast literal would
 * come out as `text` and fail to compare against `id` or assign to `numeric`.
 *
 * `organizationId` is still matched, so a crafted id cannot reach across a
 * space boundary even though the ids come from the caller.
 *
 * Returns `null` for an empty list: there is no `UPDATE` worth sending.
 *
 * NOTE: this is deliberately **not** `async`. It returns a built-but-unawaited
 * query builder for {@link runBatch}, and an `async` function would await that
 * thenable on the way out — executing the statement on its own, which is the
 * whole thing being avoided.
 */
export function reconvertEntriesStatement(
  table: TransactionTable,
  organizationId: string,
  conversions: Reconversion[],
): BatchStatement | null {
  if (conversions.length === 0) {
    return null;
  }

  const [first, ...rest] = conversions;

  const values = sql.join(
    [
      sql`(${first.id}::integer, ${first.baseAmount}::numeric, ${first.rate}::numeric)`,
      ...rest.map((row) => sql`(${row.id}, ${row.baseAmount}, ${row.rate})`),
    ],
    sql`, `,
  );

  return db
    .update(table)
    .set({ baseAmount: sql`v."baseAmount"`, exchangeRate: sql`v."exchangeRate"` })
    .from(sql`(values ${values}) as v(id, "baseAmount", "exchangeRate")`)
    .where(and(eq(table.id, sql`v.id`), eq(table.organizationId, organizationId)));
}
