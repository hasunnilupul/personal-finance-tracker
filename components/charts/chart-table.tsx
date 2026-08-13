import { ReactNode } from "react";

interface ChartTableProps {
  /** What the disclosure is called — "Show the figures". */
  summary: string;
  /** Column headings, in order. */
  columns: string[];
  /** One array per row, already formatted for display. */
  rows: ReactNode[][];
}

/**
 * The table twin of a chart.
 *
 * Every chart on a page ships one. It is the reason a tooltip is allowed to be
 * a convenience rather than the only way to read a value, and it is what makes
 * the figures reachable when colour is not — the income hue sits just under 3:1
 * against the light card, so the numbers have to be readable without it.
 *
 * A `details` element rather than a toggle in state: it works before hydration,
 * it is a real disclosure to a screen reader, and it costs no JavaScript.
 */
const ChartTable = ({ summary, columns, rows }: ChartTableProps) => {
  return (
    <details className="group mt-3">
      <summary className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1 text-xs marker:content-none">
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ›
        </span>
        {summary}
      </summary>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground border-border border-b">
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={
                    index === 0 ? "py-1.5 pr-3 font-medium" : "py-1.5 pr-3 text-right font-medium"
                  }
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={
                      cellIndex === 0
                        ? "text-foreground py-1.5 pr-3"
                        : "text-foreground py-1.5 pr-3 text-right tabular-nums"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default ChartTable;
