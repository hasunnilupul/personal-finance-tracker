"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRange, RANGE_PRESETS } from "@/lib/reports/range";

interface ReportRangePickerProps {
  basePath: string;
  range: DateRange;
}

const CUSTOM = "custom";

/**
 * The one control that scopes the whole reports page.
 *
 * Presets before a custom range — "the last six months" is not something anyone
 * wants to pick off a calendar twice. Choosing dates switches the select to
 * Custom on its own, so the two halves cannot disagree about what is on screen.
 *
 * The range lives in the URL, like the transaction filters and the budget
 * month, so a particular view can be bookmarked and every figure below is
 * rendered on the server from the same slice.
 */
const ReportRangePicker = ({ basePath, range }: ReportRangePickerProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();

      router.push(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, router],
  );

  const choosePreset = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === CUSTOM) {
        // Seed the inputs with the range already on screen, so switching to
        // Custom does not blank the page while both ends are empty.
        params.set("range", CUSTOM);
        params.set("from", range.from);
        params.set("to", range.to);
      } else {
        params.set("range", value);
        params.delete("from");
        params.delete("to");
      }

      push(params);
    },
    [push, range.from, range.to, searchParams],
  );

  const chooseDate = useCallback(
    (key: "from" | "to", value: string) => {
      if (!value) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());

      params.set("range", CUSTOM);
      params.set("from", key === "from" ? value : range.from);
      params.set("to", key === "to" ? value : range.to);

      push(params);
    },
    [push, range.from, range.to, searchParams],
  );

  const isCustom = range.key === CUSTOM;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-range" className="text-xs">
          Period
        </Label>
        <Select value={range.key} onValueChange={(value) => choosePreset(String(value))}>
          <SelectTrigger id="report-range" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_PRESETS.map((preset) => (
              <SelectItem key={preset.key} value={preset.key}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCustom && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-from" className="text-xs">
              From
            </Label>
            <Input
              id="report-from"
              type="date"
              className="w-40"
              max={range.to}
              defaultValue={range.from}
              onChange={(event) => chooseDate("from", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-to" className="text-xs">
              To
            </Label>
            <Input
              id="report-to"
              type="date"
              className="w-40"
              min={range.from}
              defaultValue={range.to}
              onChange={(event) => chooseDate("to", event.target.value)}
            />
          </div>
        </>
      )}

      <p className="text-muted-foreground pb-2 text-xs">{range.label}</p>
    </div>
  );
};

export default ReportRangePicker;
