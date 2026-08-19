import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The splash must always be able to leave.
 *
 * `components/app-splash.tsx` is a fixed overlay across the entire viewport,
 * painted from the server response and removed by nothing but a CSS animation.
 * That is a deliberate design — no hydration, no effect, no JavaScript on the
 * path that shows it — and the cost of it is this single point of failure: if
 * `ff-splash-dismiss` ever stops running, the application is behind a screen
 * that never lifts. Not slow, not degraded. Gone.
 *
 * The realistic way that happens is not deleting the rule. It is somebody
 * tidying the stylesheet by folding the fade-out in with the decorative
 * animations under `prefers-reduced-motion`, where they are all switched off
 * together — a change that looks like respecting a preference and reads
 * perfectly in review, because the animation it disables is the one nobody
 * thinks of as an animation. Every developer testing without that preference
 * set would see nothing wrong.
 *
 * So this asserts the shape rather than the appearance: the dismissal exists
 * unconditionally, and it survives reduced motion.
 */

const CSS = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

const DISMISS_ANIMATION = "ff-splash-dismiss";
const REDUCED_MOTION_AT_RULE = "@media (prefers-reduced-motion: reduce)";

/** The body of the block starting at `openIndex`, matched by braces. */
function blockBodyAt(source: string, openIndex: number): string {
  const start = source.indexOf("{", openIndex);

  let depth = 0;

  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start + 1, i);
      }
    }
  }

  throw new Error("Unbalanced braces in globals.css");
}

/** The reduced-motion block, and everything outside it. */
function splitOnReducedMotion(): { reducedMotion: string; everythingElse: string } {
  const at = CSS.indexOf(REDUCED_MOTION_AT_RULE);

  expect(at, `${REDUCED_MOTION_AT_RULE} not found in globals.css`).toBeGreaterThan(-1);

  const reducedMotion = blockBodyAt(CSS, at);

  return { reducedMotion, everythingElse: CSS.replace(reducedMotion, "") };
}

describe("splash dismissal", () => {
  it("defines the dismissal animation at all", () => {
    // A guard on the guard: every assertion below would pass vacuously against
    // a stylesheet that had lost the keyframes entirely.
    expect(CSS).toContain(`@keyframes ${DISMISS_ANIMATION}`);
    expect(CSS).toContain(".ff-splash");
  });

  it("dismisses unconditionally, outside every media query", () => {
    const { everythingElse } = splitOnReducedMotion();

    const rule = everythingElse.indexOf(".ff-splash {");

    expect(rule, "no unconditional .ff-splash rule").toBeGreaterThan(-1);

    const body = blockBodyAt(everythingElse, rule);

    expect(body).toContain(DISMISS_ANIMATION);

    // Without `forwards` the element snaps back to fully opaque the instant the
    // animation ends, which is the same outcome as never fading at all.
    expect(body).toContain("forwards");
  });

  it("still dismisses under reduced motion", () => {
    const { reducedMotion } = splitOnReducedMotion();

    const rule = reducedMotion.indexOf(".ff-splash {");

    expect(rule, "reduced motion does not restate .ff-splash").toBeGreaterThan(-1);

    const body = blockBodyAt(reducedMotion, rule);

    // The decorative animations are switched off here, and that is fine. This
    // one is not decorative — it is the only thing that uncovers the app.
    expect(body).toContain(DISMISS_ANIMATION);
    expect(body).toContain("forwards");
    expect(body).not.toMatch(/animation:\s*none/);
  });

  it("keeps the splash hidden for a session that has already seen it", () => {
    // The other half of `lib/pwa/splash.ts`: the gate sets the attribute, and
    // nothing hides the splash unless this selector exists to read it.
    expect(CSS).toMatch(/html\[data-splash="done"\]\s*\.ff-splash/);
  });
});
