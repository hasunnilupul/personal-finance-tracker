import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every route has an error boundary above it, and every layout has one beside
 * it.
 *
 * This fails silently in the same way a missing `loading.tsx` does, only worse.
 * An uncaught render error looks like nothing at all until the day something
 * throws, and then it takes the whole tree — including, under `(dashboard)`,
 * the sidebar and the topbar that were the only way out of the failed page.
 *
 * Two rules, and the second is the one with teeth:
 *
 * 1. `app/error.tsx` and `app/global-error.tsx` exist. They are the net under
 *    everything, so their absence is unbounded.
 * 2. **A segment that owns a `layout.tsx` owns an `error.tsx`.** That is the
 *    principle rather than a list: a layout is UI worth keeping on screen when
 *    something below it fails, and it is exactly what a boundary further up
 *    would throw away. It also self-maintains — a new route group with a layout
 *    fails this until it is given a boundary, without anybody remembering to
 *    add it here.
 *
 * The root is the one exception, and it is a real one rather than a carve-out:
 * `error.tsx` never wraps the `layout.tsx` in its own segment, so `app/`'s
 * layout is covered by `global-error.tsx` instead. Rule 1 is what checks it.
 */

const APP_DIR = path.join(process.cwd(), "app");

/** Directory paths relative to `app/`, with forward slashes on every platform. */
function directoriesContaining(file: string, dir: string = APP_DIR): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    found.push(...directoriesContaining(file, path.join(dir, entry.name)));
  }

  if (existsSync(path.join(dir, file))) {
    found.push(path.relative(APP_DIR, dir).split(path.sep).join("/") || ".");
  }

  return found;
}

describe("error boundaries", () => {
  it("keeps the two files everything else falls back to", () => {
    // Without `app/error.tsx` a throw outside `(dashboard)` reaches
    // `global-error.tsx`, which replaces the document — including, on a page
    // that was streaming, whatever had already been sent.
    expect(existsSync(path.join(APP_DIR, "error.tsx"))).toBe(true);

    // Without this one the root layout failing shows Next's built-in default,
    // which says nothing and offers no way to retry.
    expect(existsSync(path.join(APP_DIR, "global-error.tsx"))).toBe(true);
  });

  it("finds the app's layouts at all", () => {
    // A guard on the guard: a walk that found nothing would let the assertion
    // below pass against an empty list.
    const layouts = directoriesContaining("layout.tsx");

    expect(layouts).toContain("(dashboard)");
    expect(layouts).toContain(".");
  });

  it("gives every segment that owns a layout an error boundary beside it", () => {
    const missing = directoriesContaining("layout.tsx").filter((segment) => {
      // The root's layout is covered by `global-error.tsx`, asserted above,
      // because a segment's own `error.tsx` never wraps its own layout.
      if (segment === ".") {
        return false;
      }

      return !existsSync(path.join(APP_DIR, segment, "error.tsx"));
    });

    expect(missing).toEqual([]);
  });

  it("keeps the dashboard's boundary specifically", () => {
    // Named rather than left to the rule above, because this is the one the
    // feature exists for: a failed page here keeps the sidebar, the topbar and
    // the mobile navigation on screen. If the group is ever restructured, this
    // should fail loudly rather than pass because the layout moved too.
    expect(existsSync(path.join(APP_DIR, "(dashboard)", "error.tsx"))).toBe(true);
  });
});
