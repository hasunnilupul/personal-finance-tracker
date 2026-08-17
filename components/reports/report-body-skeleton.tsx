import {
  ChartSkeleton,
  LoadingRegion,
  SectionCardSkeleton,
  StatTilesSkeleton,
} from "@/components/skeletons/skeleton-blocks";
import { MeterRowsSkeleton } from "@/components/skeletons/row-skeletons";

/**
 * The reports page while a range is being answered: four totals, a chart and a
 * breakdown.
 *
 * The chart placeholder is a real 160px plot area rather than one grey slab.
 * It is the tallest thing on the page, so getting its height wrong is what a
 * reader would actually see move.
 */
const ReportBodySkeleton = () => {
  return (
    <LoadingRegion label="Loading reports" className="flex flex-col gap-4">
      <StatTilesSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-4" />

      <SectionCardSkeleton>
        <ChartSkeleton />
      </SectionCardSkeleton>

      <SectionCardSkeleton>
        <MeterRowsSkeleton rows={5} className="mt-4" />
      </SectionCardSkeleton>
    </LoadingRegion>
  );
};

export default ReportBodySkeleton;
