"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { errorDigest, visibleErrorDetail } from "@/lib/errors/error-presentation";
import { logger } from "@/lib/logger/logger";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Where this boundary sits, for the log line. Not shown to the reader. */
  boundary: string;
  error: Error & { digest?: string };
  /**
   * Re-fetches and re-renders the segment. This is Next's `unstable_retry`,
   * never `reset` — see the boundaries for why the distinction decides whether
   * the button can work at all.
   */
  onRetry: () => void;
  title: string;
  description: string;
  /** Anything offered beside "Try again" — usually a way out of the segment. */
  children?: ReactNode;
  className?: string;
}

/**
 * The single error UI every boundary in the app renders.
 *
 * One component rather than four copies, because the part worth getting right
 * is not the layout — it is the decision about what an error may say, and that
 * decision has to be the same everywhere. `visibleErrorDetail` makes it once;
 * a boundary cannot opt out of it, because it never sees a formatted string to
 * print.
 *
 * The wrapper is deliberately unopinionated about size and position. The
 * dashboard boundary renders this inside the app shell with the sidebar still
 * on screen, and the root boundary renders it centred on an empty page — same
 * component, different container, so the two can never drift into saying
 * different things about the same failure.
 */
const ErrorState = ({
  boundary,
  error,
  onRetry,
  title,
  description,
  children,
  className,
}: ErrorStateProps) => {
  useEffect(() => {
    // The message is stripped from a Server Component error before it reaches
    // here, so this is not the server's log — the server already wrote that,
    // and the digest below is what joins the two. What this adds is the client
    // half: that the reader actually saw a failure, and where.
    logger.error("Error boundary caught a render failure", error, {
      boundary,
      digest: error.digest,
    });
  }, [boundary, error]);

  const detail = visibleErrorDetail(error, process.env.NODE_ENV === "development");
  const digest = errorDigest(error);

  return (
    // `role="alert"` because this replaced content the reader asked for, which
    // is the definition of something worth interrupting for. The same rule
    // Feature 9d settled on: announce the failure, never the confirmation.
    <Card role="alert" className={cn("w-full p-6", className)}>
      <div className="flex items-start gap-3">
        <TriangleAlertIcon className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />

        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>

          <p className="text-muted-foreground mt-2 text-sm">{description}</p>

          {detail && (
            // Development only, and the boundary has no say in that. Wrapped
            // and scrollable because a stack-adjacent message is long and must
            // not stretch the card past the viewport on a phone.
            <pre className="border-border text-muted-foreground mt-3 max-h-40 overflow-auto border p-2 text-left text-xs whitespace-pre-wrap">
              {detail}
            </pre>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={onRetry}>
              <RefreshCwIcon data-icon="inline-start" aria-hidden />
              Try again
            </Button>

            {children}
          </div>

          {digest && (
            // Shown so a report can carry it. It is a hash of the error, not a
            // description of it, so it says nothing to anyone who has not got
            // the server logs open beside it.
            <p className="text-muted-foreground mt-4 text-xs">
              Reference: <span className="font-medium">{digest}</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ErrorState;
