import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/dal";
import { ServiceError } from "@/lib/services/errors";
import { exportFilename, streamTransactionCsv } from "@/lib/export/transactions";
import type { TransactionFilters, TransactionKind } from "@/lib/db/models/transaction.model";
import { logger } from "@/lib/logger";

/**
 * Hands the active space's entries back as a CSV download.
 *
 * **A route handler rather than a Server Action.** An action returns a value to
 * a React tree; this has to be a *response* — with its own content type and a
 * `Content-Disposition` — because the thing being produced is a file the
 * browser saves, not data a component renders.
 *
 * It is scoped exactly like every other read: `requirePermission` resolves the
 * active space from the session and checks the role, and the space id used by
 * the query comes from that resolution rather than from anything in the URL.
 * There is deliberately no `spaceId` parameter — an export is the one endpoint
 * where a missing scope check hands over the whole ledger at once.
 */
export const dynamic = "force-dynamic";

/** `YYYY-MM-DD` or nothing. Anything else is ignored rather than guessed at. */
function isoDateParam(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function kindParam(value: string | null): TransactionKind | undefined {
  return value === "expense" || value === "income" ? value : undefined;
}

export async function GET(request: Request) {
  let active;

  try {
    active = await requirePermission({ transaction: ["read"] });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    throw error;
  }

  const params = new URL(request.url).searchParams;

  const filters: TransactionFilters = {
    from: isoDateParam(params.get("from")),
    to: isoDateParam(params.get("to")),
  };

  const rows = streamTransactionCsv({
    ctx: active.ctx,
    kind: kindParam(params.get("kind")),
    filters,
  });

  const encoder = new TextEncoder();

  // Set when the reader goes away — navigated off, hit stop, lost the network.
  // Without it a `pull` already awaiting a chunk resolves *after* the stream is
  // torn down and calls `close()` on a dead controller, which throws
  // "Invalid state: Controller is already closed" and then reports a cancelled
  // download as a server error. Found by the browser suite; invisible to every
  // other check.
  let cancelled = false;

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await rows.next();

        if (cancelled) {
          return;
        }

        if (done) {
          controller.close();

          return;
        }

        controller.enqueue(encoder.encode(value));
      } catch (error) {
        if (cancelled) {
          return;
        }

        // The headers are already sent by the time a later chunk fails, so
        // there is no status left to change. Erroring the stream truncates the
        // download, which the browser reports as a failed transfer — a partial
        // file that looked complete would be far worse for something somebody
        // is about to treat as their records.
        logger.error("Export failed part-way through", error);

        controller.error(error);
      }
    },

    cancel() {
      cancelled = true;

      // Let the generator run its `finally` blocks rather than leaving the
      // walk suspended.
      void rows.return(undefined);
    },
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(active.space.name, new Date())}"`,
      // It contains the ledger. No shared cache should ever hold it, and the
      // browser should not serve it again from disk to whoever is next.
      "Cache-Control": "no-store, private",
    },
  });
}
