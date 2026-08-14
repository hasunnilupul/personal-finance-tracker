import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentMonthKey, MonthKey, shiftMonth } from "@/lib/budgets/period";

interface BudgetPeriodNavProps {
  /** The month on screen, `YYYY-MM`. */
  month: MonthKey;
  label: string;
}

/**
 * Moves the page between calendar months.
 *
 * Links rather than buttons, with the month in the URL, so a particular month
 * can be bookmarked and the page stays a Server Component — the same rule the
 * transaction filters follow. Periods are calendar-aligned, so this one control
 * moves the monthly section by a month and carries the yearly section with it
 * whenever the year changes.
 */
const BudgetPeriodNav = ({ month, label }: BudgetPeriodNavProps) => {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const isCurrent = month === currentMonthKey();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        {/*
          `nativeButton` has to track what `render` actually produced: an anchor
          when there is a month to go to, a real <button> when there is not. A
          static value is wrong for one of the two states — see Gotchas.
        */}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous month"
          disabled={!previous}
          nativeButton={!previous}
          render={previous ? <Link href={`/budgets?month=${previous}`} /> : undefined}
        >
          <ChevronLeftIcon />
        </Button>

        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next month"
          disabled={!next}
          nativeButton={!next}
          render={next ? <Link href={`/budgets?month=${next}`} /> : undefined}
        >
          <ChevronRightIcon />
        </Button>

        <p className="text-foreground ml-2 text-sm font-medium">{label}</p>
      </div>

      {!isCurrent && (
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/budgets" />}>
          Back to this month
        </Button>
      )}
    </div>
  );
};

export default BudgetPeriodNav;
