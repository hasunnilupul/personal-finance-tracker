import { test, expect } from "@playwright/test";

import { E2E_EMAIL, SPLASH_SESSION_KEY } from "./support";

/**
 * Everything reachable without a session.
 *
 * These run with no stored cookies on purpose — `storageState: undefined`
 * overrides the project default — because "the sign-in page renders" is only
 * worth asserting for somebody who is actually signed out.
 */
test.use({ storageState: undefined });

test.describe("signed out", () => {
  test("the root path sends a stranger to sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("the sign-in card renders, brand and all", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    // The mark is `decorative` beside the wordmark, so it is deliberately not
    // in the accessibility tree — assert the drawing, not a label it must not
    // have. `.first()` because the splash carries one too.
    await expect(page.locator("svg.size-7").first()).toBeVisible();
  });

  test("a wrong password is refused, and says so", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill(E2E_EMAIL);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // The message is the app's to choose; what matters is that it is announced
    // and that the browser is still standing on the sign-in page afterwards.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("the offline page answers on its own", async ({ page }) => {
    // Precached at install so a navigation with no network has something to
    // land on. If it stops answering, the service worker's fallback is a 404
    // and nobody finds out until they are on a train.
    const response = await page.goto("/offline");

    expect(response?.status()).toBe(200);
  });

  test("the manifest is served as a manifest", async ({ request }) => {
    // Chrome will not offer to install the app if this is wrong, and it fails
    // by simply never showing the prompt — no error anywhere.
    const response = await request.get("/manifest.webmanifest");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/manifest+json");
  });
});

test.describe("the splash gate", () => {
  test("plays on a cold start and is marked done for the rest of the session", async ({ page }) => {
    await page.goto("/sign-in");

    // First load of a fresh context: nothing marked, so the stylesheet leaves
    // the overlay visible and the gate records that it has been seen.
    await expect(page.locator("html")).not.toHaveAttribute("data-splash", "done");
    await expect(page.locator(".ff-splash")).toHaveCount(1);

    expect(await page.evaluate((key) => sessionStorage.getItem(key), SPLASH_SESSION_KEY)).toBe("1");

    await page.reload();

    // Second load, same session. This is the assertion that would have caught
    // the gate being moved, deleted, or made to run after the first paint.
    await expect(page.locator("html")).toHaveAttribute("data-splash", "done");
    await expect(page.locator(".ff-splash")).toBeHidden();
  });

  test("the overlay lifts, so the app is never left behind it", async ({ page }) => {
    await page.goto("/sign-in");

    // The failure this exists for is total: `.ff-splash` covers the viewport,
    // and if `ff-splash-dismiss` ever stops running the application is gone —
    // not slow, not degraded, unreachable. `app/splash-dismissal.test.ts`
    // asserts the stylesheet's shape; this asserts the actual outcome in a
    // browser, which is the half a unit test cannot reach.
    await expect(page.locator(".ff-splash")).toBeHidden({ timeout: 10_000 });

    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("the gate script survives being rendered by React", async ({ page }) => {
    await page.goto("/sign-in");

    // Read out of the DOM rather than through a locator: Playwright matches
    // `hasText` against rendered text, and a `<script>` renders none, so a
    // locator reports zero whether the gate is there or not — a test that
    // passes only by being deleted.
    const gate = await page.evaluate((key) => {
      const scripts = [...document.querySelectorAll("script:not([src])")].filter(
        (node) =>
          node.textContent?.includes(key) &&
          // Next's RSC flight payload serialises the layout's markup back into
          // the document, gate source and all, so a naive count of scripts
          // mentioning the key is 2 in any App Router page. That one is data
          // being replayed into `self.__next_f`, not a script that runs.
          !node.textContent.trimStart().startsWith("self.__next_f"),
      );

      const splash = document.querySelector(".ff-splash");
      const first = scripts[0];

      return {
        count: scripts.length,
        inBody: first ? first.closest("body") !== null : false,
        beforeSplash:
          first && splash
            ? !!(first.compareDocumentPosition(splash) & Node.DOCUMENT_POSITION_FOLLOWING)
            : false,
      };
    }, SPLASH_SESSION_KEY);

    // The exact defect of 2026-08-19: inside a hand-written `<head>`, React
    // re-created the element on the client and substituted a `<div>` for it.
    // Four green checks and a dev-only console error were the only signs.
    expect(gate.count).toBe(1);
    expect(gate.inBody).toBe(true);

    // And it must come before the markup it governs, or it cannot beat the
    // paint it exists for.
    expect(gate.beforeSplash).toBe(true);
  });
});
