import { Suspense } from "react";

import ReportBody from "@/components/reports/report-body";
import ReportBodySkeleton from "@/components/reports/report-body-skeleton";
import ReportRangePicker from "@/components/reports/report-range-picker";
import { requireActiveSpace } from "@/lib/auth/dal";
import { resolveRange } from "@/lib/reports/range";

interface ReportsPageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}

/**
 * Reports over a date range: what came in, what went out, where it went, and
 * how that moved month to month.
 *
 * One range control at the top scopes every figure on the page, so the totals,
 * the breakdown and the trend can never be showing different slices. The range
 * comes from the URL, so the page stays a Server Component and a particular
 * view can be bookmarked.
 *
 * The picker sits above the `<Suspense>` boundary and the figures inside it,
 * keyed on the range. `resolveRange` is pure, so the control renders from the
 * URL alone and stays interactive while the range it just asked for is being
 * counted — including the second click of a custom from/to pair.
 */
const ReportsPage = async ({ searchParams }: ReportsPageProps) => {
  const params = await searchParams;
  const { space } = await requireActiveSpace();

  const range = resolveRange(params);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Income and spending over a period, in {space.baseCurrency}.
        </p>
      </div>

      <ReportRangePicker basePath="/reports" range={range} />

      <Suspense key={`${range.key}|${range.from}|${range.to}`} fallback={<ReportBodySkeleton />}>
        <ReportBody range={range} />
      </Suspense>
    </div>
  );
};

export default ReportsPage;
