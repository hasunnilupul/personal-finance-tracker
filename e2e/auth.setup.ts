import { test as setup, expect } from "@playwright/test";

import { E2E_EMAIL, E2E_NAME, E2E_PASSWORD, restorePersonalSpace, STORAGE_STATE } from "./support";

/**
 * Gets the suite a signed-in session, and leaves the cookies where the other
 * tests can pick them up.
 *
 * **This is the point of the whole feature.** "Needs a signed-in browser with
 * the owner's own credentials" has been written into six consecutive release
 * records as a standing gap — the dashboard error boundary, the sign-out cache
 * purge, push delivery, all unverifiable without one. A suite that can sign
 * itself in is what retires that, and it does it without ever holding a real
 * person's password.
 *
 * **Sign-in is tried first, and the order is not arbitrary.** The account
 * exists on every run but the first, so signing up first meant waiting out a
 * doomed navigation before falling back — which cost 15s of a 30s budget and
 * made the fixture fail 2.4s after successfully signing in. The rare path pays
 * the wait now, not the common one.
 */
setup("sign in as the suite's own account", async ({ page }) => {
  // Generous, because this may be the run that creates the account: two form
  // submissions through a real auth stack, either of which can be slow on a
  // cold server.
  setup.setTimeout(90_000);

  const signedIn = async () => {
    await page.goto("/");

    return new URL(page.url()).pathname === "/";
  };

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page
    .waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 })
    .catch(() => {
      // No account yet, or the password is wrong. Either way the next block
      // decides, and a wrong password there fails loudly rather than here.
    });

  if (!(await signedIn())) {
    // Sign-up is invite-only by default and the suite has no invitation, which
    // is why the test server runs with `ALLOW_PUBLIC_SIGNUP=true`. See
    // `playwright.config.ts` for why that lives there rather than in `.env`.
    await page.goto("/sign-up");

    await page.getByLabel("Name").fill(E2E_NAME);
    await page.getByLabel("Email").fill(E2E_EMAIL);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/sign-up"), { timeout: 20_000 });
  }

  // Assert the session rather than trusting a redirect: a signed-out visitor is
  // bounced to `/sign-in`, so "left the form" alone would also be true of a
  // failure that landed somewhere else entirely.
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:\d+\/$/);

  // Start every run in the personal space. The active space is server-side
  // account state that survives between runs, so a run interrupted while the
  // space-switching spec had the account in a shared space would otherwise
  // leave the next one asserting against the wrong ledger — and failing
  // somewhere far from the cause. See `restorePersonalSpace`.
  await restorePersonalSpace(page);

  await page.context().storageState({ path: STORAGE_STATE });
});
