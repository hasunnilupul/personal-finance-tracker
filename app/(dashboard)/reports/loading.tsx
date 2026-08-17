import ReportBodySkeleton from "@/components/reports/report-body-skeleton";
import { ControlBarSkeleton, PageHeaderSkeleton } from "@/components/skeletons/skeleton-blocks";

/**
 * The reports page on a first visit: header, range control, then the figures.
 *
 * Only the first load blanks the range picker. Changing the range afterwards
 * leaves it in place and falls back to {@link ReportBodySkeleton} alone.
 */
const ReportsLoading = () => {
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden className="flex flex-col gap-4">
        <PageHeaderSkeleton />

        <ControlBarSkeleton fields={1} />
      </div>

      <ReportBodySkeleton />
    </div>
  );
};

export default ReportsLoading;
