import { test, expect, type Locator, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./support";

/**
 * Adding, editing and deleting an expense shows the result before the server has
 * answered it — and puts the page back if the server never does.
 *
 * **These write to the development database**, which most of the suite does not.
 * Every entry carries a note unique to its test, and `afterEach` removes anything
 * carrying the prefix, so a test that fails half-way cannot leave a row behind for
 * the next run to trip over. See PLAN.md for what stray rows have cost before.
 *
 * The server is slowed or cut off from the browser's side: Server Actions are a
 * POST to the page's own URL carrying a `next-action` header, so the request can
 * be told apart and held for a while, or refused.
 */
test.use({ storageState: STORAGE_STATE });

// Several writes, each a real round trip to a database across an ocean from here.
test.describe.configure({ timeout: 180_000 });

const PREFIX = "e2e-optimistic";

/** How long a held request waits. Long enough to look at the page in between. */
const HELD_MS = 7_000;

/** A page change that is shown before the server answers must be shown inside this. */
const SOON = { timeout: 2_500 };

/** Server Actions on the expenses page. */
const isAction = (request: { method: () => string; headers: () => Record<string, string> }) =>
  request.method() === "POST" && "next-action" in request.headers();

async function holdActions(page: Page) {
  await page.route(
    (url) => url.pathname === "/expenses",
    async (route) => {
      if (isAction(route.request())) {
        await new Promise((resolve) => setTimeout(resolve, HELD_MS));
      }

      await route.continue();
    },
  );
}

// Hangs, then fails: a connection that drops is slow to say so. Failing at once
// would show the row and take it back faster than anything could observe.
async function refuseActions(page: Page) {
  await page.route(
    (url) => url.pathname === "/expenses",
    async (route) => {
      if (!isAction(route.request())) {
        return route.continue();
      }

      await new Promise((resolve) => setTimeout(resolve, HELD_MS / 2));
      await route.abort("failed");
    },
  );
}

const rowFor = (page: Page, note: string): Locator =>
  page.getByRole("listitem").filter({ hasText: note });

async function addExpense(page: Page, note: string, amount = "12.34") {
  await page.getByRole("button", { name: "Add expense" }).first().click();
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Note").fill(note);
  await page.getByRole("button", { name: "Add expense", exact: true }).last().click();
}

async function removeRow(page: Page, row: Locator) {
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
}

/**
 * Deletes whatever a test left, through the same page a person would.
 *
 * **It waits for the server, not for the page.** A deleted row leaves the list at
 * once, before the delete has been sent, so the list emptying proves nothing: the
 * first version of this ended with the requests still in flight and the rows
 * still in the database, cancelled when the test's page closed. Each delete is
 * awaited by its response, and the list is read again from the server at the end.
 */
async function sweep(page: Page) {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.goto(`/expenses?search=${PREFIX}&from=&to=`);

  const rows = page.getByRole("listitem").filter({ hasText: PREFIX });

  // The filter bar is there long before the list is. Counting rows while the
  // skeleton is still up reads zero and ends the sweep with the row untouched.
  await expect(page.getByText(/total$/i)).toBeVisible({ timeout: 60_000 });

  for (let attempts = 0; attempts < 10 && (await rows.count()) > 0; attempts++) {
    // A row that is still waiting on its real id has no Delete to press yet.
    await expect(rows.first().getByRole("button", { name: "Delete" })).toBeEnabled({
      timeout: 30_000,
    });

    const answered = page.waitForResponse((response) => isAction(response.request()), {
      timeout: 60_000,
    });

    await removeRow(page, rows.first());
    await answered;
  }

  await page.reload();
  await expect(page.getByText(/total$/i)).toBeVisible({ timeout: 60_000 });
  await expect(rows).toHaveCount(0);
}

test.afterEach(async ({ page }) => {
  await sweep(page);
});

test.describe("a write on the expenses page", () => {
  test("adding shows the row before the server answers, and it stays", async ({ page }) => {
    const note = `${PREFIX}-add-${Date.now()}`;

    await page.goto("/expenses");
    await holdActions(page);

    await addExpense(page, note);

    // The server is being made to wait; the page is not.
    await expect(page.getByRole("dialog")).toBeHidden(SOON);
    await expect(rowFor(page, note)).toBeVisible(SOON);

    // It has no real id yet, so there is nothing to edit or delete by.
    await expect(rowFor(page, note).getByRole("button", { name: "Edit" })).toBeDisabled();

    // Once the server answers it becomes an ordinary row...
    await expect(rowFor(page, note).getByRole("button", { name: "Edit" })).toBeEnabled({
      timeout: HELD_MS + 60_000,
    });

    // ...and it is really there, not only on this page.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.reload();
    await expect(rowFor(page, note)).toBeVisible({ timeout: 30_000 });
  });

  test("deleting removes the row before the server answers, and it stays gone", async ({
    page,
  }) => {
    const note = `${PREFIX}-delete-${Date.now()}`;

    await page.goto("/expenses");
    await addExpense(page, note);
    await expect(rowFor(page, note).getByRole("button", { name: "Delete" })).toBeEnabled({
      timeout: 60_000,
    });

    await holdActions(page);
    await removeRow(page, rowFor(page, note));

    await expect(rowFor(page, note)).toHaveCount(0, SOON);

    // Past the point the server answers, it must not reappear for a moment: the
    // optimistic layer lifting and the real data arriving have to be one step.
    await page.waitForTimeout(HELD_MS + 3_000);
    await expect(rowFor(page, note)).toHaveCount(0);

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.reload();
    await expect(page.getByLabel("From")).toBeVisible({ timeout: 30_000 });
    await expect(rowFor(page, note)).toHaveCount(0);
  });

  test("editing shows the change before the server answers", async ({ page }) => {
    const note = `${PREFIX}-edit-${Date.now()}`;
    const edited = `${note}-changed`;

    await page.goto("/expenses");
    await addExpense(page, note);
    await expect(rowFor(page, note).getByRole("button", { name: "Edit" })).toBeEnabled({
      timeout: 60_000,
    });

    await holdActions(page);
    await rowFor(page, note).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Note").fill(edited);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("dialog")).toBeHidden(SOON);
    await expect(rowFor(page, edited)).toBeVisible(SOON);

    await page.waitForTimeout(HELD_MS + 3_000);
    await expect(rowFor(page, edited)).toBeVisible();

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.reload();
    await expect(rowFor(page, edited)).toBeVisible({ timeout: 30_000 });
    await expect(rowFor(page, note).filter({ hasNotText: "-changed" })).toHaveCount(0);
  });

  test("a save that never reaches the server puts the page back and offers the entry again", async ({
    page,
  }) => {
    const note = `${PREFIX}-fail-${Date.now()}`;

    await page.goto("/expenses");
    await refuseActions(page);

    await addExpense(page, note, "55.50");

    // Shown at first, as for any other save...
    await expect(rowFor(page, note)).toBeVisible(SOON);

    // ...then taken back, with the reason, and a way to get the entry back.
    await expect(rowFor(page, note)).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(/could not reach the server/i)).toBeVisible();

    await page.getByRole("button", { name: "Edit again" }).click();

    await expect(page.getByLabel("Note")).toHaveValue(note);
    await expect(page.getByLabel("Amount")).toHaveValue("55.50");
  });

  test("a foreign-currency save is not guessed at, and waits for the server as before", async ({
    page,
  }) => {
    const note = `${PREFIX}-foreign-${Date.now()}`;

    await page.goto("/expenses");
    await holdActions(page);

    await page.getByRole("button", { name: "Add expense" }).first().click();
    await page.getByLabel("Amount").fill("9.99");
    await page.getByLabel("Note").fill(note);
    await page.getByRole("combobox", { name: "Currency" }).click();
    await page.getByRole("option").filter({ hasNotText: /^LKR$/ }).first().click();
    await page.getByRole("button", { name: "Add expense", exact: true }).last().click();

    // No row yet — its converted amount is the server's to work out — and the
    // dialog stays open saying it is saving, exactly as it always did.
    await page.waitForTimeout(2_000);
    await expect(rowFor(page, note)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Saving..." })).toBeVisible();

    // The save still goes through, just late. Wait for it to land: ending the test
    // first would let the cleanup run before the row exists and miss it.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: HELD_MS + 60_000 });
    await expect(rowFor(page, note)).toBeVisible({ timeout: 30_000 });
  });
});
