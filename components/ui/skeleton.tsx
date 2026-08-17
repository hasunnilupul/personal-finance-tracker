import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * One placeholder block, standing in for a line, a figure or a control.
 *
 * `bg-muted` rather than a hand-picked grey: it is the same token the progress
 * meters use for their unfilled track, so a skeleton reads as "empty" in both
 * themes without a second colour to keep in step.
 *
 * The pulse is behind `motion-safe`. Reduced motion leaves a static block,
 * which still says "not here yet" — the shape carries that, not the animation.
 *
 * No rounding: `--radius` is `0` in this theme, so a `rounded-*` class would
 * compute to square anyway and only suggest a curve that never appears. Callers
 * that need a circle (an avatar, a category chip) pass `rounded-full`, which is
 * not derived from the token.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export { Skeleton };
