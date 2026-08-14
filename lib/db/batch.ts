import type { BatchItem } from "drizzle-orm/batch";

import { db } from "@/lib/db";

/**
 * One statement queued for a batched write.
 *
 * This is a drizzle query builder that has been **built but not awaited**.
 * Awaiting one sends it on its own; collecting several and handing them to
 * {@link runBatch} sends them together, inside a transaction.
 */
export type BatchStatement = BatchItem<"pg">;

/**
 * Runs several statements as one all-or-nothing write.
 *
 * The HTTP driver has no *interactive* transactions — it cannot hold `BEGIN`
 * open across round trips, which is why multi-step writes here compute
 * everything before writing anything. It does have **non-interactive** ones:
 * `db.batch` sends the whole list in a single request wrapped in a single
 * transaction, so either every statement lands or none does.
 *
 * That is the difference between a failure leaving a mess and a failure leaving
 * nothing at all. The constraint it keeps is that the statements must all be
 * known up front — nothing here can read a result and decide what to write
 * next. Any query that informs the write has to happen before the batch opens.
 *
 * @param statements Built, un-awaited query builders. An empty list is a no-op,
 * because `db.batch` rejects one.
 * @returns Each statement's result, positionally. A statement with no
 * `returning` clause contributes an empty slot.
 */
export async function runBatch(statements: BatchStatement[]): Promise<unknown[]> {
  if (statements.length === 0) {
    return [];
  }

  return db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

/**
 * How many rows one statement's slot in a batch response came back with.
 *
 * Only meaningful for a statement built with `.returning()`; anything else
 * reports zero.
 */
export function rowsReturned(result: unknown): number {
  return Array.isArray(result) ? result.length : 0;
}

/**
 * Drops the statements a caller had nothing to write for.
 *
 * The statement builders return `null` for an empty input — there is no
 * `UPDATE` that updates no rows worth sending — so composing a batch means
 * filtering those out.
 */
export function statements(...candidates: (BatchStatement | null)[]): BatchStatement[] {
  return candidates.filter((statement): statement is BatchStatement => statement !== null);
}
