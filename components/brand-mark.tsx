/**
 * The FinanceFlow mark, as geometry rather than a picture.
 *
 * The app icon in `public/` is a raster export with a ribboned "F", a rising
 * arrow, three bars and a coin, layered over a gradient tile. This is not a
 * trace of it. Hand-copying those ribbons into path data produces a worse
 * version of a drawing the reader already has on their home screen — close
 * enough to invite comparison and never close enough to survive it.
 *
 * So this keeps the two elements that carry the meaning and animate honestly —
 * the bars rising and the arrow climbing over them — in the icon's own blue-to-
 * green gradient, and lets the wordmark carry the name in the app's own
 * typeface. What the reader recognises on the splash is the same idea, drawn
 * for the medium it is in.
 *
 * A plain Server Component with no client JavaScript: it has to be in the first
 * paint, which is the whole point of a launch screen. Everything that moves is
 * CSS, keyed off the `data-splash-animate` attributes below.
 */

interface BrandMarkProps {
  className?: string;
  /** Marks the parts CSS animates. Off for any static use of the mark. */
  animated?: boolean;
}

const BrandMark = ({ className, animated = false }: BrandMarkProps) => {
  // `undefined` rather than `false` — React omits the attribute entirely, so
  // the CSS selectors simply do not match and nothing needs a second rule.
  const animate = animated ? "" : undefined;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="FinanceFlow"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/*
          Anchored to the artwork's own diagonal rather than the viewBox.
          The marks occupy a narrow band from the arrow's foot at (8,54) to the
          tallest bar at (56,10); a gradient spanning the full 64×64 canvas
          gives that band only the middle of its range, so the whole mark came
          out one flat teal. `gradientUnits="userSpaceOnUse"` with the band's
          own endpoints is what puts green at the bottom of the climb and blue
          at the top of it — the icon's actual reading.
        */}
        <linearGradient
          id="ff-mark-gradient"
          gradientUnits="userSpaceOnUse"
          x1="8"
          y1="54"
          x2="56"
          y2="10"
        >
          {/* The icon's own range: green at the foot, through teal, to blue at
              the top. Read off the 512 export rather than invented. */}
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="55%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      <g fill="url(#ff-mark-gradient)">
        {/* Ascending bars. Each rises from its own foot, which is why every one
            carries `transform-origin` at the bottom in the stylesheet — the
            default is the centre, and they would grow in both directions. */}
        <rect
          x="24"
          y="38"
          width="8"
          height="16"
          rx="1"
          data-splash-bar="1"
          data-splash-animate={animate}
        />
        <rect
          x="36"
          y="30"
          width="8"
          height="24"
          rx="1"
          data-splash-bar="2"
          data-splash-animate={animate}
        />
        <rect
          x="48"
          y="20"
          width="8"
          height="34"
          rx="1"
          data-splash-bar="3"
          data-splash-animate={animate}
        />
      </g>

      {/*
        The climb. `pathLength="100"` normalises the path to 100 units whatever
        its real geometry, so the stylesheet can draw it with a dash offset of
        100 without anybody measuring the curve — and it stays correct if the
        curve is ever redrawn.
      */}
      <path
        d="M 8 52 Q 22 46 41 20"
        pathLength="100"
        fill="none"
        stroke="url(#ff-mark-gradient)"
        strokeWidth="5"
        strokeLinecap="round"
        data-splash-arrow=""
        data-splash-animate={animate}
      />

      <polygon
        points="52,10 47.3,22.6 39.1,13.8"
        fill="url(#ff-mark-gradient)"
        data-splash-head=""
        data-splash-animate={animate}
      />
    </svg>
  );
};

export default BrandMark;
