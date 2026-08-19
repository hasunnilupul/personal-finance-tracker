import "server-only";

import { findTransactionChunk, type TransactionCursor } from "@/lib/repositories/transaction-query";
import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import type { TransactionFilters, TransactionKind } from "@/lib/db/models/transaction.model";
import { CSV_BOM, csvRow } from "@/lib/export/csv";

/**
 * A space's entries, as a CSV stream.
 *
 * **Streamed rather than assembled.** A few years of a shared household's
 * entries is not enormous, but the size is the user's rather than ours and an
 * export that builds the whole file in memory first is a function whose cost
 * nobody controls. Chunked and pushed, the server holds one chunk at a time
 * however long the history is.
 */

const TABLES = { expense: expenses, income } as const;

/** Rows per round trip. Large enough to be few trips, small enough to hold. */
const CHUNK_SIZE = 500;

/**
 * The columns, and why there are this many money ones.
 *
 * An entry has *two* amounts and they are different numbers: what was actually
 * spent, in the currency it was spent in, and what that came to in the space's
 * base currency at that day's rate. Exporting only the base amount loses what
 * really happened; exporting only the entered amount gives a column that cannot
 * be summed. Both, plus the rate that connects them, is the only honest answer
 * — and it is what makes the file reconcilable against a bank statement.
 */
const HEADER = [
  "Date",
  "Type",
  "Description",
  "Category",
  "Amount",
  "Currency",
  "Exchange rate",
  "Amount (base)",
  "Base currency",
  "Entered by",
] as const;

/** `YYYY-MM-DD`, which sorts correctly as text and is what spreadsheets parse. */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export interface ExportOptions {
  organizationId: string;
  baseCurrency: string;
  /** Absent means both. */
  kind?: TransactionKind;
  filters: TransactionFilters;
}

/**
 * Which kinds to walk, in order.
 *
 * Both kinds are walked separately and written one after the other rather than
 * merged into one date order. Merging two keyset walks would mean holding a
 * row from each and comparing as it goes — real complexity for an ordering any
 * spreadsheet can reproduce with one click on the Date column. The `Type`
 * column is what makes the two halves separable.
 */
function kindsFor(kind?: TransactionKind): TransactionKind[] {
  return kind ? [kind] : ["expense", "income"];
}

/**
 * Emits the file, one chunk at a time.
 *
 * An async generator rather than a `ReadableStream` built by hand: the cursor
 * is loop state, and expressing it as loop state means it cannot be advanced
 * on a path that did not emit the row it came from.
 */
export async function* streamTransactionCsv(options: ExportOptions): AsyncGenerator<string> {
  yield CSV_BOM + csvRow([...HEADER]);

  for (const kind of kindsFor(options.kind)) {
    let cursor: TransactionCursor | null = null;

    for (;;) {
      const rows = await findTransactionChunk(
        TABLES[kind],
        options.organizationId,
        options.filters,
        cursor,
        CHUNK_SIZE,
      );

      if (rows.length === 0) {
        break;
      }

      yield rows
        .map((row) =>
          csvRow([
            isoDate(row.date),
            kind,
            row.description,
            row.categoryName,
            row.amount,
            row.currency,
            row.exchangeRate,
            row.baseAmount,
            options.baseCurrency,
            row.createdByName,
          ]),
        )
        .join("");

      // A short chunk means the table is exhausted; asking again would cost a
      // round trip to be told the same thing.
      if (rows.length < CHUNK_SIZE) {
        break;
      }

      const last = rows[rows.length - 1];

      cursor = { date: last.date, id: last.id };
    }
  }
}

/**
 * What the browser should call the file.
 *
 * The space name is user input and goes into a header, so everything that is
 * not a plain word is replaced rather than escaped — a quote or a newline in a
 * `Content-Disposition` is a header-injection question, and there is no reason
 * to have that conversation over a filename.
 */
export function exportFilename(spaceName: string, on: Date): string {
  const slug =
    spaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "space";

  return `financeflow-${slug}-${isoDate(on)}.csv`;
}
