import { describe, expect, it } from "vitest";

import { csvCell, csvRow, CSV_NEWLINE } from "@/lib/export/csv";

/**
 * These assert the refusals, not the happy path.
 *
 * A CSV writer that handles plain words is trivially correct and useless as a
 * guarantee. Everything here is a value that a person can actually type into a
 * description field, and each one breaks the file in a way nobody notices until
 * they open it a month later.
 */

describe("csvCell", () => {
  it("leaves ordinary text alone", () => {
    expect(csvCell("Groceries")).toBe("Groceries");
    expect(csvCell(42)).toBe("42");
  });

  it("renders nothing for an absent value", () => {
    // `description` and `categoryName` are both nullable, and "null" appearing
    // in a spreadsheet cell is the classic tell that they were not handled.
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });

  it("quotes a value containing a comma", () => {
    // Without this the row gains a column and every field after it shifts.
    expect(csvCell("Taxi, airport")).toBe('"Taxi, airport"');
  });

  it("doubles internal quotes and wraps the cell", () => {
    expect(csvCell('He said "cheap"')).toBe('"He said ""cheap"""');
  });

  it("quotes a value containing a newline", () => {
    // A textarea description can carry one, and unquoted it ends the record —
    // the rest of the file parses one row short with no error anywhere.
    expect(csvCell("Line one\nLine two")).toBe('"Line one\nLine two"');
    expect(csvCell("Carriage\rreturn")).toBe('"Carriage\rreturn"');
  });

  it("defuses a formula, because in a shared space somebody else wrote it", () => {
    // The owner opens the file; the spreadsheet evaluates the cell. This is the
    // one case here that is a security property rather than a formatting one.
    // Quoted as well as guarded: this one also contains a comma, so both rules
    // apply and the apostrophe must land *inside* the quotes.
    expect(csvCell("=IMPORTXML(A1,B1)")).toBe('"\'=IMPORTXML(A1,B1)"');
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("still quotes a defused formula that also contains a comma", () => {
    // Both problems at once, and the order matters: guard first, then quote,
    // or the apostrophe lands outside the quotes and breaks the structure.
    expect(csvCell("=A1,B1")).toBe('"\'=A1,B1"');
  });

  it("does not mangle a negative number", () => {
    // A negative amount begins `-`. Treating it as a formula would turn every
    // one into text and break the arithmetic the export exists to enable.
    expect(csvCell("-1500.00")).toBe("-1500.00");
    expect(csvCell(-42)).toBe("-42");
  });
});

describe("csvRow", () => {
  it("joins cells and terminates with CRLF", () => {
    expect(csvRow(["a", "b"])).toBe(`a,b${CSV_NEWLINE}`);
  });

  it("keeps empty columns in place", () => {
    // A row whose middle column is dropped rather than left empty puts every
    // later value under the wrong heading.
    expect(csvRow(["a", null, "c"])).toBe(`a,,c${CSV_NEWLINE}`);
  });
});
