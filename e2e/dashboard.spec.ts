import { test, expect } from "@playwright/test";

import { STORAGE_STATE } from "./support";

/**
 * The shell a signed-in person actually looks at.
 *
 * These are the first automated assertions in this project that required a
 * session. Everything they touch — the sidebar, the topbar, the mobile brand
 * row — has until now been verified by somebody opening a browser and looking,
 * or, in the case of the sidebar in PR #50, not verified at all.
 */
test.use({ storageState: STORAGE_STATE });

test.describe("the dashboard shell", () => {
  test("paints for a signed-in session", async ({ page }) => {
    await page.goto("/");

    // A signed-out session is redirected to `/sign-in`, so staying here is
    // itself the assertion that the stored cookies are real.
    await expect(page).toHaveURL(/localhost:\d+\/$/);

    await expect(page.getByRole("heading", { name: "Your money" })).toBeVisible();
  });

  test("shows the sidebar, mark included, at a desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const sidebar = page.locator("aside");

    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("heading", { name: "FinanceFlow" })).toBeVisible();

    // The half of PR #50 that merged without anybody seeing it: the window
    // would not resize past a phone-width viewport and the extension
    // disconnected. This is that check, made permanent.
    await expect(sidebar.locator("svg")).toBeVisible();
  });

  test("swaps the sidebar for the bottom bar on a phone, and still shows the brand", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // Below `md` the sidebar is hidden, which is exactly why the brand row was
    // added to the topbar — otherwise the app names itself nowhere on the
    // viewport it is most often opened in.
    await expect(page.locator("aside")).toBeHidden();

    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();

    // Scoped to the header on purpose. Three elements say "FinanceFlow" on this
    // page — the splash word, the sidebar heading (hidden, but present), and
    // this one — so an unscoped match is a strict-mode failure that says
    // nothing about whether the row a phone user sees is there.
    await expect(page.locator("header").getByText("FinanceFlow", { exact: true })).toBeVisible();
  });

  test("navigates to expenses and keeps the shell", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await page.getByRole("link", { name: "Expenses" }).first().click();

    await expect(page).toHaveURL(/\/expenses/);

    // The shell surviving a navigation is the thing Feature 14's boundaries
    // exist to preserve. If a page throws, this is what should still be here.
    await expect(page.locator("aside")).toBeVisible();
  });
});
