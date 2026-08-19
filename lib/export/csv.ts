/**
 * Turning values into CSV that a spreadsheet reads back correctly.
 *
 * Small enough to look obvious and wrong in three separate ways if written
 * from memory, which is why it is here with tests rather than inline in the
 * route: a description containing a comma, a quote or a newline is ordinary
 * user text, and each one silently corrupts every column after it.
 */

/**
 * Prepended to the file so Excel reads it as UTF-8.
 *
 * Without it Excel on Windows decodes the bytes as the system codepage and a
 * space named "Café" arrives as "CafÃ©". Every other consumer tolerates the
 * mark, so it costs nothing but three bytes.
 */
export const CSV_BOM = "﻿";

/** CRLF, which is what the CSV spec says and what Excel is happiest with. */
export const CSV_NEWLINE = "\r\n";

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * One cell, escaped.
 *
 * Two separate problems, and they are often confused:
 *
 * 1. **Structure.** A cell containing a quote, a comma or a newline has to be
 *    quoted, with internal quotes doubled. Otherwise the row silently gains
 *    columns and every later one is wrong.
 * 2. **Formula injection.** A spreadsheet evaluates a cell beginning `=`, `+`,
 *    `-` or `@`. In a *shared* space the descriptions are written by other
 *    people, so a row could carry `=IMPORTXML(...)` that runs when the owner
 *    opens the file. Prefixing with an apostrophe is the standard mitigation —
 *    the spreadsheet shows the text and does not evaluate it.
 *
 * Numbers are exempted from (2) deliberately. A negative amount begins `-` and
 * is not an attack; prefixing it would turn every one into text and break the
 * arithmetic the export exists to enable.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (text === "") {
    return "";
  }

  const guarded = FORMULA_PREFIX.test(text) && !Number.isFinite(Number(text)) ? `'${text}` : text;

  if (/["\n\r,]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }

  return guarded;
}

/** One row, terminated. */
export function csvRow(cells: readonly (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",") + CSV_NEWLINE;
}
