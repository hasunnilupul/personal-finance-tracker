"use client";

import { KeyboardEvent, ReactNode, useId, useRef, useSyncExternalStore } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChartView {
  key: string;
  /** The tab: one word. */
  label: string;
  content: ReactNode;
  /** Replaces the card's heading while this view is showing. */
  heading?: string;
  /** Replaces the card's description while this view is showing. */
  description?: string;
}

interface ChartViewsProps {
  /** Names the choice in storage, and the tab list for a screen reader. */
  id: string;
  heading: string;
  description?: string;
  views: ChartView[];
}

/**
 * Which view each card was last left on.
 *
 * The reports body sits under a `<Suspense>` keyed on the range, so picking
 * another range remounts everything inside it — and a choice held in
 * component state would snap back to the first view every time. A module-level
 * map outlives the remount without a storage API that can be blocked, throw, or
 * disagree between server and client; the server snapshot is always "nothing
 * chosen", so hydration agrees and the choice lands just after.
 *
 * It is a per-tab convenience, not a setting: a reload starts from the first
 * view again.
 */
const chosen = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function choose(id: string, key: string): void {
  chosen.set(id, key);
  listeners.forEach((listener) => listener());
}

/**
 * A card that offers the same figures in more than one chart.
 *
 * The views are different readings of one answer — a ranking or a share, a
 * comparison or a net — not different filters, so they live in the card's own
 * header and never touch the page's range control, which scopes all of them at
 * once.
 *
 * Only the showing view is mounted. The panels arrive already rendered by the
 * server, so a view that needs no client code (the category bars) stays free
 * of it, and switching costs a state change rather than a request.
 */
const ChartViews = ({ id, heading, description, views }: ChartViewsProps) => {
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const stored = useSyncExternalStore(
    subscribe,
    () => chosen.get(id) ?? null,
    () => null,
  );

  // A stored key can name a view this render does not offer — "Net" in a space
  // that has no income — so it falls back rather than showing an empty panel.
  const activeIndex = Math.max(
    0,
    views.findIndex((view) => view.key === stored),
  );
  const active = views[activeIndex];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = views.length - 1;
    const target =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;

    if (target === null) {
      return;
    }

    event.preventDefault();
    choose(id, views[target].key);
    tabRefs.current[target]?.focus();
  };

  const shownHeading = active.heading ?? heading;
  const shownDescription = active.description ?? description;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">{shownHeading}</h2>
          {shownDescription && (
            <p className="text-muted-foreground mt-0.5 text-xs">{shownDescription}</p>
          )}
        </div>

        {views.length > 1 && (
          <div
            role="tablist"
            aria-label={`${heading}: view`}
            className="bg-muted inline-flex shrink-0 rounded-md p-0.5"
          >
            {views.map((view, index) => {
              const selected = index === activeIndex;

              return (
                <button
                  key={view.key}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  id={`${tabsId}-tab-${view.key}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${tabsId}-panel`}
                  // Roving tabindex: the list is one stop, arrows move within it.
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(id, view.key)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={cn(
                    "focus-visible:ring-ring rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        id={`${tabsId}-panel`}
        role={views.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={views.length > 1 ? `${tabsId}-tab-${active.key}` : undefined}
      >
        {active.content}
      </div>
    </Card>
  );
};

export default ChartViews;
