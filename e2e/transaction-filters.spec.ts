import { test, expect } from "@playwright/test";

import { STORAGE_STATE } from "./support";

/**
 * What the Expenses and Income pages open on, and the search box on them.
 *
 * Read-only on purpose: nothing here writes an entry, so a run that aborts
 * half-way cannot leave data behind for the next one to trip over.
 */
test.use({ storageState: STORAGE_STATE });

/**
 * A URL only changes once the navigation behind it commits, and that waits on
 * the server rendering the page against the database. Under a parallel run that
 * outlasts the 5s default, so assertions on it are given the budget the other
 * specs give a page.
 */
const NAVIGATED = { timeout: 15_000 };

/** The current month as the page computes it — first and last day, in UTC. */
function thisMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

for (const path of ["/expenses", "/income"]) {
  test.describe(`${path}`, () => {
    test("opens on the current month, without rewriting the URL", async ({ page }) => {
      const { from, to } = thisMonth();

      await page.goto(path);

      await expect(page.getByLabel("From")).toHaveValue(from);
      await expect(page.getByLabel("To")).toHaveValue(to);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });

    test("lets the range be cleared, and Clear puts the month back", async ({ page }) => {
      const { from, to } = thisMonth();

      await page.goto(path);

      await page.getByLabel("From").fill("");
      await expect(page).toHaveURL(/from=(&|$)/, NAVIGATED);

      await page.getByLabel("To").fill("");
      await expect(page).toHaveURL(/to=(&|$)/, NAVIGATED);

      // An empty end is "no limit", not "fall back to the month".
      await expect(page.getByLabel("From")).toHaveValue("");
      await expect(page.getByLabel("To")).toHaveValue("");

      await page.getByRole("button", { name: "Clear" }).click();

      await expect(page).toHaveURL(new RegExp(`${path}$`), NAVIGATED);
      await expect(page.getByLabel("From")).toHaveValue(from);
      await expect(page.getByLabel("To")).toHaveValue(to);
    });

    // The list is not swapped for a skeleton while the next results load: the old
    // rows stay and the region is marked pending. A skeleton is the first visit's.
    //
    // Watched with an observer for the whole load, not looked for once. A skeleton
    // that arrives a beat after the pending flag is exactly the failure this is
    // for, and a single check at the flag's moment cannot see it.
    test("keeps the results on screen while a search loads", async ({ page }) => {
      await page.goto(path);

      const results = page.locator("[data-pending]");

      await expect(results).toHaveAttribute("data-pending", "false", NAVIGATED);
      await expect(page.getByText(/total$/i)).toBeVisible(NAVIGATED);

      await page.evaluate(() => {
        const w = window as unknown as { sawSkeleton: boolean };
        w.sawSkeleton = false;

        new MutationObserver(() => {
          const loading = document.querySelectorAll("[role=status] .sr-only");

          if ([...loading].some((el) => /^Loading (expenses|income)$/.test(el.textContent ?? ""))) {
            w.sawSkeleton = true;
          }
        }).observe(document.body, { childList: true, subtree: true });
      });

      await page.getByRole("searchbox", { name: "Search" }).fill("zz-keeps-the-list");

      await expect(results).toHaveAttribute("data-pending", "true", NAVIGATED);
      await expect(results).toHaveAttribute("data-pending", "false", NAVIGATED);
      await expect(page).toHaveURL(/search=zz-keeps-the-list/);
      await expect(page.getByText(/total$/i)).toBeVisible();

      expect(
        await page.evaluate(() => (window as unknown as { sawSkeleton: boolean }).sawSkeleton),
      ).toBe(false);
    });

    test("searches, and Clear empties the box", async ({ page }) => {
      await page.goto(path);

      const search = page.getByRole("searchbox", { name: "Search" });

      await search.fill("zz-no-such-entry-zz");

      await expect(page).toHaveURL(/search=zz-no-such-entry-zz/, NAVIGATED);
      await expect(page.getByText(/matches those filters/)).toBeVisible(NAVIGATED);

      await page.getByRole("button", { name: "Clear" }).click();

      await expect(page).toHaveURL(new RegExp(`${path}$`), NAVIGATED);
      await expect(search).toHaveValue("");
    });
  });
}

test("savings still opens on everything", async ({ page }) => {
  await page.goto("/savings");

  await expect(page.getByLabel("From")).toHaveValue("");
  await expect(page.getByLabel("To")).toHaveValue("");
});
