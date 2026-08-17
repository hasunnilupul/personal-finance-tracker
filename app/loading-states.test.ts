import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every route answers a navigation with a skeleton of its own shape.
 *
 * This is the one part of the loading work that fails **silently**. A skeleton
 * is on screen for a few hundred milliseconds and only while data is in
 * flight, so a route that lost its `loading.tsx` — or a new route that never
 * had one — looks fine in every screenshot and simply feels slower.
 *
 * Worse than absent is inherited: a route under `(dashboard)` with no file of
 * its own falls back to `app/(dashboard)/loading.tsx`, which is the dashboard's
 * own skeleton. Opening `/goals` would flash a grid of month totals and budget
 * bars, then replace it with a list of goals. That reads as a page that changed
 * its mind, and nothing warns about it.
 *
 * So the rule is checked structurally rather than by rendering anything: a
 * directory with a `page.tsx` has a `loading.tsx` beside it, or it is named
 * below with the reason it does not need one.
 */

const APP_DIR = path.join(process.cwd(), "app");

/**
 * Routes that render without waiting on anything, so a fallback would only
 * flash. Each one is here because it was checked, not because it was missed.
 */
const NO_DATA_TO_WAIT_FOR: Record<string, string> = {
  "(auth)/sign-in": "A form. No query runs before it renders.",
  "(auth)/sign-up": "A form. No query runs before it renders.",
  offline: "Precached and static — it is what the service worker serves offline.",
};

/** Directory paths relative to `app/`, with forward slashes on every platform. */
function routeDirectories(dir: string = APP_DIR): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    found.push(...routeDirectories(path.join(dir, entry.name)));
  }

  if (existsSync(path.join(dir, "page.tsx"))) {
    found.push(path.relative(APP_DIR, dir).split(path.sep).join("/"));
  }

  return found;
}

describe("loading states", () => {
  const routes = routeDirectories();

  it("finds the app's routes at all", () => {
    // A guard on the guard: a walk that silently found nothing would let every
    // assertion below pass against an empty list.
    expect(routes.length).toBeGreaterThan(10);
    expect(routes).toContain("(dashboard)/budgets");
  });

  it("gives every route a loading state, or an explicit reason for having none", () => {
    const missing = routes.filter((route) => {
      if (route in NO_DATA_TO_WAIT_FOR) {
        return false;
      }

      return !existsSync(path.join(APP_DIR, route, "loading.tsx"));
    });

    expect(missing).toEqual([]);
  });

  it("keeps no stale exemptions", () => {
    // An exemption for a route that has moved or gained a query is worse than
    // no list: it reads as a decision that was made about the route as it is
    // now.
    for (const route of Object.keys(NO_DATA_TO_WAIT_FOR)) {
      expect(routes, `${route} is exempted but no longer a route`).toContain(route);
      expect(
        existsSync(path.join(APP_DIR, route, "loading.tsx")),
        `${route} is exempted but has a loading.tsx — drop the exemption`,
      ).toBe(false);
    }
  });
});
