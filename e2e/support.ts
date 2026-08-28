import path from "node:path";

/**
 * The suite's own account, and where its cookie jar is kept.
 *
 * **One stable account rather than one per run.** A fresh email each time would
 * leave a trail of dead users and personal spaces in the development database
 * that nothing ever cleans up. This signs up once and signs in forever after,
 * so the cost to the database is exactly one row.
 *
 * The address is on `.test`, which is reserved by RFC 2606 and can never be a
 * real mailbox — so this cannot collide with a person, and nothing it does can
 * send mail anywhere.
 */
export const E2E_EMAIL = "e2e@financeflow.test";

/**
 * Not a secret, and it must not be treated as one.
 *
 * It guards an account that exists only in a development database and holds
 * nothing but whatever the suite itself writes. Putting it in an environment
 * variable would imply otherwise and make the suite fail confusingly on a
 * machine that had not set it.
 */
export const E2E_PASSWORD = "e2e-smoke-password";

export const E2E_NAME = "Smoke Test";

/** Where `auth.setup.ts` leaves the signed-in cookies for the other tests. */
export const STORAGE_STATE = path.join(__dirname, ".auth", "state.json");

/** The shared space the space-switching spec works in. */
export const E2E_SHARED_SPACE = "E2E Shared";

/**
 * Puts the account back in its personal space.
 *
 * **The active space is account-wide state held on the server**, not in the
 * cookie jar — `activeOrganizationId` lives on the session row. So a spec that
 * switches spaces changes what *every* other spec sees, and a run that ends
 * part-way through one leaves the account somewhere the next run does not
 * expect. This is called both by the sign-in fixture, so a run always starts
 * from a known space, and by the space-switching spec, so it always ends in
 * one.
 *
 * Exported from here rather than kept in that spec precisely because the setup
 * needs it too: one definition, so the guarantee cannot drift between them.
 */
export async function restorePersonalSpace(page: import("@playwright/test").Page) {
  const { expect } = await import("@playwright/test");

  await page.goto("/");

  // Located by its label rather than by role: the switcher is Base UI's Select
  // trigger, whose role is an implementation detail of that library. It renders
  // inside the topbar's own <Suspense>, so it arrives after the page.
  const switcher = page.getByLabel("Active space");

  await expect(switcher).toBeVisible({ timeout: 15_000 });

  if ((await switcher.textContent())?.trim() === "Personal") {
    return;
  }

  await switcher.click();

  // `.first()` because a name is not unique — nothing stops somebody naming a
  // shared space "Personal". `listForUser` orders the personal space first and
  // then by name, so the first match is always the real one.
  const option = page.getByRole("option", { name: "Personal", exact: true }).first();

  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();

  // **Wait for the control to come back before reading it.** `SpaceSwitcher`
  // disables the trigger for the duration of the server action and the
  // `router.refresh()` after it, and while disabled it still shows the *old*
  // space. Asserting the text alone raced that: the assertion polled a stale
  // label until it timed out, on a switch that had not finished rather than one
  // that had failed. Enabled-then-text is the order that cannot lie.
  await expect(switcher).toBeEnabled({ timeout: 30_000 });
  await expect(switcher).toHaveText(/Personal/, { timeout: 15_000 });
}

/** The key the splash gate writes, mirrored from `lib/pwa/splash.ts`. */
export const SPLASH_SESSION_KEY = "financeflow:splash-shown";
