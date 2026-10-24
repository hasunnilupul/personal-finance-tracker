import { test, expect, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./support";

/**
 * Whether a click on a tab waits on the server.
 *
 * Read-only, and it runs against the production build the suite always uses —
 * prefetching is switched off under `next dev`, so this would prove nothing there.
 *
 * Page fetches are the requests carrying Next's `_rsc` query. What matters is
 * which of them happen *after the click*: a link with `prefetch` fetches its whole
 * page at load time with a request that looks just like a navigation, so telling
 * the two apart by headers does not work and the test counts from the click
 * instead.
 */
test.use({ storageState: STORAGE_STATE });

/**
 * Every page behind a prefetch is a real render against the database, and the
 * browser starts all of them at once. The default 30s is for a test that looks at
 * one page; these wait for several to land before they can say anything.
 */
test.describe.configure({ timeout: 120_000 });

/** A URL only changes once the navigation behind it commits — see `transaction-filters.spec.ts`. */
const NAVIGATED = { timeout: 15_000 };

interface PageFetch {
  path: string;
  finished: boolean;
}

function watchPageFetches(page: Page): PageFetch[] {
  const seen: PageFetch[] = [];
  const byRequest = new Map<unknown, PageFetch>();

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (!url.searchParams.has("_rsc")) {
      return;
    }

    const entry = { path: url.pathname, finished: false };

    seen.push(entry);
    byRequest.set(request, entry);
  });

  // An aborted request never finishes, and Next aborts a prefetch the moment a
  // navigation to the same page supersedes it — so both outcomes mean "done".
  const settle = (request: unknown) => {
    const entry = byRequest.get(request);

    if (entry) {
      entry.finished = true;
    }
  };

  page.on("requestfinished", settle);
  page.on("requestfailed", settle);

  return seen;
}

/** Fetches of `path` made after `mark` — pass `seen.length` just before clicking. */
const fetchedSince = (seen: PageFetch[], mark: number, path: string) =>
  seen.slice(mark).filter((fetch) => fetch.path === path).length;

/** Every fetch of `path` so far has completed, and there was at least one. */
const settled = (seen: PageFetch[], path: string) => {
  const forPath = seen.filter((fetch) => fetch.path === path);

  return forPath.length > 0 && forPath.every((fetch) => fetch.finished);
};

const sidebarLink = (page: Page, name: string) =>
  page.locator("aside").getByRole("link", { name: new RegExp(`${name}$`) });

test.describe("moving between tabs", () => {
  test("a prefetched tab opens without a request of its own", async ({ page }) => {
    const seen = watchPageFetches(page);

    await page.goto("/");

    // Prefetching runs after load, once the links are on screen. Clicking before
    // it finishes would test the race, not the behaviour. Two fetches of this
    // path are expected: the skeleton's and the whole page's; wait for both.
    await expect
      .poll(
        () => {
          const forExpenses = seen.filter((f) => f.path === "/expenses");

          return forExpenses.length >= 2 && forExpenses.every((f) => f.finished);
        },
        { timeout: 90_000 },
      )
      .toBe(true);

    const mark = seen.length;

    await sidebarLink(page, "Expenses").click();
    await expect(page).toHaveURL(/\/expenses/, NAVIGATED);
    await expect(page.getByLabel("From")).toBeVisible(NAVIGATED);

    expect(fetchedSince(seen, mark, "/expenses")).toBe(0);
  });

  test("a tab visited a moment ago is not fetched a second time", async ({ page }) => {
    const seen = watchPageFetches(page);

    await page.goto("/");

    // Budgets is not one of the fully prefetched links, so its first visit asks.
    let mark = seen.length;

    await sidebarLink(page, "Budgets").click();
    await expect(page).toHaveURL(/\/budgets/, NAVIGATED);
    await expect
      .poll(() => fetchedSince(seen, mark, "/budgets"), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect.poll(() => settled(seen, "/budgets"), { timeout: 30_000 }).toBe(true);

    await sidebarLink(page, "Goals").click();
    await expect(page).toHaveURL(/\/goals/, NAVIGATED);
    await expect.poll(() => settled(seen, "/goals"), { timeout: 30_000 }).toBe(true);

    mark = seen.length;

    await sidebarLink(page, "Budgets").click();
    await expect(page).toHaveURL(/\/budgets/, NAVIGATED);

    expect(fetchedSince(seen, mark, "/budgets")).toBe(0);
  });
});
