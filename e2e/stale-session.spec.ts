import { test, expect } from "@playwright/test";

/**
 * A session cookie the server does not recognise.
 *
 * The proxy decides whether to let a private page through on the cookie's
 * presence alone, which saves a database lookup on every request. The price is
 * that a dead cookie gets past it, and these pin what has to happen next: the
 * page turns it away, and the sign-in page — whose redirect *does* ask the
 * database — does not treat it as a signed-in user. Getting the second wrong
 * is a redirect loop between `/` and `/sign-in`.
 */
test.describe("a cookie the server does not recognise", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      { name: "better-auth.session_token", value: "not-a-real-session.xx", url: baseURL! },
    ]);
  });

  test("is sent to sign-in from a private page", async ({ page }) => {
    await page.goto("/expenses");

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible();
  });

  test("does not bounce the sign-in page back to the dashboard", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible();
  });
});
