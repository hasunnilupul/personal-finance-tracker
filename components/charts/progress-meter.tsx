import { cn } from "@/lib/utils";

interface ProgressMeterProps {
  /** How full, as a fraction. Values above 1 are capped by the fill. */
  ratio: number;
  /** Tailwind classes for the fill — the colour carries the meaning. */
  fillClassName: string;
  /** What the meter reads as to assistive technology. */
  label: string;
}

/**
 * How much of something is used, or reached.
 *
 * A plain element rather than a component from a UI library: this is a div with
 * a width, and the meter role gives assistive technology the same reading the
 * bar gives visually.
 *
 * The fill is capped at 100% so an overshoot does not paint outside the track;
 * the colour and the figures beside it say how far past it went.
 */
const ProgressMeter = ({ ratio, fillClassName, label }: ProgressMeterProps) => {
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));

  return (
    <div
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn("h-full rounded-full transition-[width]", fillClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

export default ProgressMeter;
