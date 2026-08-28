import { expect, test } from "@playwright/test";

import { E2E_SHARED_SPACE, restorePersonalSpace, STORAGE_STATE } from "./support";

/**
 * What a shared space does and does not have.
 *
 * Income belongs to a personal space and nowhere else, and expenses go the
 * other way — one added to a shared space counts against the personal ledger of
 * whoever added it. This covers the half that is visible in a browser: the
 * pages, tabs and sections that should not be there.
 *
 * **It runs in a project of its own, after every other spec.** Switching spaces
 * writes `activeOrganizationId` onto the session row, which is account-wide
 * state every other spec inherits — and Playwright runs files in parallel by
 * default. See the `space-switching` project in `playwright.config.ts` for the
 * failure that found this.
 */
test.describe.configure({ mode: "serial" });

test.use({ storageState: STORAGE_STATE });

/**
 * Switches the active space by name.
 *
 * **It never creates one, and that is a scar rather than a preference.** The
 * first version fell back to creating a space when it could not find the option
 * — and `locator.count()` does not wait, so it read zero while the dropdown was
 * still opening and created a *shared* space called "Personal" in the
 * development database. Twice. A helper that repairs what it cannot find turns
 * every timing bug into a write; this one fails instead, and
 * {@link ensureSharedSpace} is the single place allowed to create anything.
 */
async function switchTo(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");

  // Located by its label rather than by role: the switcher is Base UI's Select
  // trigger, whose role is an implementation detail of that library. It renders
  // inside the topbar's own <Suspense>, so it arrives after the page.
  const switcher = page.getByLabel("Active space");

  await expect(switcher).toBeVisible({ timeout: 15_000 });

  if ((await switcher.textContent())?.trim() === name) {
    return;
  }

  await switcher.click();

  const option = page.getByRole("option", { name, exact: true }).first();

  // Waited for, not counted. This is the assertion the original was missing.
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();

  await expect(switcher).toHaveText(new RegExp(name), { timeout: 15_000 });
}

/**
 * Creates the suite's shared space if the account does not have it yet.
 *
 * Reused across runs for the reason the account is — see `support.ts`. A fresh
 * one per run would leave a trail of dead spaces nothing ever cleans up.
 */
async function ensureSharedSpace(page: import("@playwright/test").Page) {
  await page.goto("/");

  const switcher = page.getByLabel("Active space");

  await expect(switcher).toBeVisible({ timeout: 15_000 });
  await switcher.click();

  // The listbox has to be open before anything in it is counted, for the reason
  // in `switchTo`: `count()` does not wait, and a zero read too early used to
  // mean "create one".
  await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10_000 });

  const existing = await page.getByRole("option", { name: E2E_SHARED_SPACE, exact: true }).count();

  await page.keyboard.press("Escape");

  if (existing > 0) {
    return;
  }

  await page.goto("/spaces/new");
  await page.getByLabel("Space name").fill(E2E_SHARED_SPACE);
  await page.getByRole("button", { name: "Create space" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/spaces/new"), { timeout: 20_000 });
}

/**
 * Reads a formatted money figure as a number.
 *
 * The page prints "Rs 32,571.00"; comparing two of those as strings says
 * nothing useful, and the assertion worth making is arithmetic.
 */
async function readMoney(locator: import("@playwright/test").Locator): Promise<number> {
  const text = (await locator.textContent()) ?? "";

  return Number(text.replace(/[^0-9.-]/g, ""));
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await context.newPage();

  await ensureSharedSpace(page);
  await context.close();
});

test.afterAll(async ({ browser }) => {
  // A context of its own, so the restore does not depend on a page from a test
  // that may have failed part-way — and its own storage state, because a raw
  // `browser.newPage()` is signed out.
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await context.newPage();

  await restorePersonalSpace(page);
  await context.close();
});

test.describe("a shared space", () => {
  test("has no income anywhere in its navigation", async ({ page }) => {
    await switchTo(page, E2E_SHARED_SPACE);

    const sidebar = page.getByRole("complementary");

    await expect(sidebar.getByRole("link", { name: "Expenses" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Income" })).toHaveCount(0);
  });

  test("says where income went instead of listing none", async ({ page }) => {
    await switchTo(page, E2E_SHARED_SPACE);

    await page.goto("/income");

    // An empty income list would read as income that had gone missing, which is
    // the wrong thing to tell somebody about their own money. A silent redirect
    // is barely better — and, in a streaming route, is not even reliable. See
    // the page's own comment.
    await expect(
      page.getByRole("heading", { name: "Income lives in your personal space" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: /Add income/i })).toHaveCount(0);
  });

  test("offers expense categories only", async ({ page }) => {
    await switchTo(page, E2E_SHARED_SPACE);

    await page.goto("/settings/categories");

    await expect(page.getByRole("heading", { name: /expense categories/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /income categories/i })).toHaveCount(0);
  });

  test("shows what was spent, and does not invent a net out of no income", async ({ page }) => {
    await switchTo(page, E2E_SHARED_SPACE);

    await expect(page.getByText("Spent this month")).toBeVisible();
    await expect(page.getByText("Income this month")).toHaveCount(0);
    await expect(page.getByText("Net", { exact: true })).toHaveCount(0);
  });
});

test.describe("a shared expense", () => {
  /**
   * The whole point of the change, seen from a browser.
   *
   * Everything else in this file is about what a shared space *lacks*. This is
   * the other half: an expense added to a shared space is money out of the
   * pocket of whoever added it, so it has to turn up in their personal ledger —
   * badged with the space it came from, and counted in that ledger's total.
   *
   * It writes a real entry and deletes it again, because there is no way to
   * assert this without one. The amount is deliberately odd so the total can be
   * compared before and after without depending on what else is in the space.
   */
  test("turns up in the personal ledger, badged and counted", async ({ page }) => {
    // Four space switches, each a server action and a re-render, plus a write.
    // The 30s default is for a test that looks at one page.
    test.setTimeout(180_000);

    const AMOUNT = 1234.56;
    const NOTE = "Cross-space smoke";

    await switchTo(page, "Personal");
    await page.goto("/expenses");

    const total = page.getByText(/^(Rs|LKR)/).first();
    const before = await readMoney(total);

    await switchTo(page, E2E_SHARED_SPACE);
    await page.goto("/expenses");

    await page.getByRole("button", { name: "Add expense" }).first().click();
    await page.getByLabel("Amount").fill(String(AMOUNT));
    await page.getByLabel("Note").fill(NOTE);
    await page.getByRole("button", { name: "Add expense", exact: true }).last().click();

    await expect(page.getByText(NOTE)).toBeVisible({ timeout: 15_000 });

    await switchTo(page, "Personal");
    await page.goto("/expenses");

    const row = page.getByRole("listitem").filter({ hasText: NOTE });

    await expect(row).toBeVisible({ timeout: 15_000 });

    // The badge is what tells this row apart from the personal ones beside it.
    await expect(row.getByText(E2E_SHARED_SPACE)).toBeVisible();

    // And it is read-only here: editing acts on the active space and would be
    // refused, so the controls are not offered.
    await expect(row.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0);

    const after = await readMoney(total);

    expect(Number((after - before).toFixed(2))).toBe(AMOUNT);

    // Clean up where it lives, which is the only place it can be deleted from.
    await switchTo(page, E2E_SHARED_SPACE);
    await page.goto("/expenses");

    page.on("dialog", (dialog) => dialog.accept());

    await page
      .getByRole("listitem")
      .filter({ hasText: NOTE })
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByText(NOTE)).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe("the personal space", () => {
  test("keeps every one of them", async ({ page }) => {
    await switchTo(page, "Personal");

    const sidebar = page.getByRole("complementary");

    await expect(sidebar.getByRole("link", { name: "Income" })).toBeVisible();
    await expect(page.getByText("Income this month")).toBeVisible();

    await page.goto("/income");
    await expect(page).toHaveURL(/\/income$/);

    await page.goto("/settings/categories");
    await expect(page.getByRole("heading", { name: /income categories/i })).toBeVisible();
  });
});
