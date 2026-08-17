import { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The shapes every loading state on the dashboard is built from.
 *
 * They exist once and are shared between the route-level `loading.tsx` files
 * and the in-page `<Suspense>` fallbacks, because those two are the *same*
 * screen seen at two different moments — a first visit and a filter change.
 * Two copies would drift, and the drift would show as a layout jump on one of
 * the two paths and not the other.
 *
 * Every block is sized against the real component it stands in for, in the same
 * units. A fallback that is the wrong height is worse than none: it reserves the
 * wrong space and the page jumps when the content lands.
 */

interface LoadingRegionProps {
  /**
   * What is loading, as a sentence a screen reader can read out — "Loading
   * budgets". The blocks themselves carry no text.
   */
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a set of placeholder blocks and says, once, what they stand for.
 *
 * The blocks are `aria-hidden`: a dozen empty divs announced one by one is
 * noise, and the single `role="status"` line above them carries the whole
 * meaning. `aria-busy` marks the region as still filling in, which is what
 * stops a screen reader treating the empty shapes as the finished page.
 */
export const LoadingRegion = ({ label, className, children }: LoadingRegionProps) => {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>

      <div aria-hidden className={className}>
        {children}
      </div>
    </div>
  );
};

/**
 * The title and the line under it that open every page.
 *
 * Sized to `text-xl` over `text-sm`, which is what the real headers use.
 */
export const PageHeaderSkeleton = () => {
  return (
    <div>
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-full max-w-sm" />
    </div>
  );
};

interface ControlBarSkeletonProps {
  /** How many labelled controls the real bar shows at its narrowest useful state. */
  fields?: number;
}

/**
 * A row of labelled controls: the transaction filters, the reports range picker.
 *
 * Only the placeholder is drawn, never a disabled copy of the real control. A
 * control that looks operable and is not is worse than an obvious gap.
 */
export const ControlBarSkeleton = ({ fields = 3 }: ControlBarSkeletonProps) => {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-9 w-40" />
        </div>
      ))}
    </div>
  );
};

interface StatTilesSkeletonProps {
  /** Three on the dashboard, four on reports. */
  count: number;
  className?: string;
}

/**
 * The grid of headline figures.
 *
 * The tile border is drawn for real rather than skeletonised: it is part of the
 * page's structure and it is already there before the numbers are, so painting
 * it immediately means only the figures move when they arrive.
 */
export const StatTilesSkeleton = ({ count, className }: StatTilesSkeletonProps) => {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border-border bg-card flex flex-col gap-1 border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
};

interface SectionCardSkeletonProps {
  /** Whether the real card carries a button in its header. */
  action?: boolean;
  /** Whether the header has a second, smaller line under the heading. */
  subheading?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A card with a heading, and whatever rows or chart belong inside it.
 */
export const SectionCardSkeleton = ({
  action = false,
  subheading = true,
  className,
  children,
}: SectionCardSkeletonProps) => {
  return (
    <Card className={cn("p-4 sm:p-6", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-6 w-36" />
          {subheading && <Skeleton className="mt-1.5 h-3.5 w-24" />}
        </div>

        {action && <Skeleton className="h-9 w-24" />}
      </div>

      {children}
    </Card>
  );
};

/**
 * The bar chart on the reports page: a legend, a plot area and a row of ticks.
 *
 * The columns are a fixed pattern rather than random heights — a fallback that
 * differs between the server render and the client would be a hydration
 * mismatch, and one that differs between two visits looks like real data.
 */
const COLUMN_HEIGHTS = ["45%", "70%", "35%", "85%", "55%", "75%", "40%", "60%"];

export const ChartSkeleton = () => {
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-20" />
      </div>

      <div className="mt-3">
        <div className="flex h-40 items-end gap-2">
          {COLUMN_HEIGHTS.map((height, index) => (
            <div key={index} className="flex flex-1 items-end justify-center gap-[2px]">
              <Skeleton className="w-full max-w-[14px]" style={{ height }} />
              <Skeleton
                className="w-full max-w-[14px]"
                style={{ height: COLUMN_HEIGHTS[COLUMN_HEIGHTS.length - 1 - index] }}
              />
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex gap-2">
          {COLUMN_HEIGHTS.map((_, index) => (
            <div key={index} className="flex flex-1 justify-center">
              <Skeleton className="h-2.5 w-6" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
