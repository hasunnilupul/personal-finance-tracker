"use client";

import { createContext, type ReactNode, useContext, useTransition } from "react";

import { cn } from "@/lib/utils";

interface FilterPending {
  pending: boolean;
  /** Runs a navigation inside the transition whose state {@link pending} reports. */
  start: (navigate: () => void) => void;
}

const FilterPendingContext = createContext<FilterPending | null>(null);

/**
 * Lets the filter bar, the pagination links and the list share one answer to
 * "is a new set of results on its way?".
 *
 * They sit in different places — the bar is outside the `<Suspense>` boundary on
 * purpose, the links are inside the results — so the transition that tracks the
 * navigation cannot belong to any one of them. It belongs here, above all three.
 */
export const FilterPendingProvider = ({ children }: { children: ReactNode }) => {
  const [pending, start] = useTransition();

  return <FilterPendingContext value={{ pending, start }}>{children}</FilterPendingContext>;
};

export function useFilterPending(): FilterPending {
  const context = useContext(FilterPendingContext);

  if (!context) {
    throw new Error("useFilterPending must be used inside a FilterPendingProvider");
  }

  return context;
}

/**
 * Greys out the results while the next ones load, instead of replacing them with
 * a skeleton.
 *
 * Swapping to placeholder rows on every keystroke or date change is a flash of
 * nothing where there was something to read. Keeping the old rows says "this is
 * what you had; the change is on its way", and a skeleton is left for the one
 * moment that genuinely has nothing to show — the first visit.
 *
 * The dim waits 200ms before it starts. A response faster than that never
 * flickers; a slower one is told apart from a page that ignored the click, which
 * is the problem keeping the old rows would otherwise bring back. Coming back to
 * full opacity is immediate, because it only happens once the new rows are there.
 */
export const FilterPendingDim = ({ children }: { children: ReactNode }) => {
  const { pending } = useFilterPending();

  return (
    <div
      data-pending={pending}
      aria-busy={pending}
      className={cn("flex flex-col gap-4", pending && "opacity-60 transition-opacity delay-200")}
    >
      {children}
    </div>
  );
};
