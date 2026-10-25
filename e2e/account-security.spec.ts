import { test, expect, type Page } from "@playwright/test";

/**
 * Changing a password, and getting back in without one.
 *
 * **This uses its own account, not the suite's.** Changing a password signs out
 * every other session, and the suite's account is the one whose session is saved
 * in `state.json` and read by every other spec in parallel — revoking it would
 * fail unrelated tests far from the cause. So this signs up a second stable
 * account (one row, like the first) and works only on that one.
 *
 * **It signs in once and shares the page.** better-auth rate-limits sign-in,
 * sign-up and change-password to three requests per ten seconds, and the suite
 * runs a production build, where that is switched on. A test that signed in for
 * itself failed on the limit, fell through to sign-up, and reported "User
 * already exists" — a message about the account that was really about the clock.
 *
 * It goes `A → B → A` inside one test and ends where it began. If a run is
 * interrupted between the two, the account is left on `B`, and the next run
 * finds it by trying both.
 */
test.use({ storageState: undefined });

test.describe.configure({ mode: "serial" });

const SECURITY_EMAIL = "e2e-security@financeflow.test";
const PASSWORD_A = "e2e-security-password";
const PASSWORD_B = "e2e-security-password-2";

/** The rate limit's window, plus a little. */
const RATE_LIMIT_WINDOW_MS = 10_500;

async function signInWith(page: Page, password: string): Promise<boolean> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(SECURITY_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  return page
    .waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
}

/** Signs the account in, creating it the first time, and returns the password it holds. */
async function enter(page: Page): Promise<string> {
  if (await signInWith(page, PASSWORD_A)) {
    return PASSWORD_A;
  }

  if (await signInWith(page, PASSWORD_B)) {
    return PASSWORD_B;
  }

  // Two failed sign-ins is the limit's whole allowance; let it reset before the
  // sign-up, which counts against the same one.
  await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Security Test");
  await page.getByLabel("Email").fill(SECURITY_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD_A);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-up"), { timeout: 20_000 });

  return PASSWORD_A;
}

async function submitChange(page: Page, current: string, next: string, confirmation = next) {
  await page.goto("/settings/account");

  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(confirmation);
  await page.getByRole("button", { name: "Change password" }).click();
}

/** The form's own message — `getByRole("alert")` alone also matches Next's route announcer. */
const formAlert = (page: Page) => page.locator("form p[role='alert']");

test.describe("account security", () => {
  test.setTimeout(120_000);

  let page: Page;
  let held: string;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();

    held = await enter(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("a password can be changed, and only the new one signs in", async ({ browser }) => {
    const original = held;
    const changed = original === PASSWORD_A ? PASSWORD_B : PASSWORD_A;

    try {
      await submitChange(page, original, changed);
      await expect(page.getByText("Password changed")).toBeVisible({ timeout: 15_000 });
      held = changed;

      // The old password no longer works — in a context with no session of its
      // own, so it is the credential being tested and not a leftover cookie.
      const stranger = await browser.newContext();
      const strangerPage = await stranger.newPage();

      await strangerPage.goto("/sign-in");
      await strangerPage.getByLabel("Email").fill(SECURITY_EMAIL);
      await strangerPage.getByLabel("Password").fill(original);
      await strangerPage.getByRole("button", { name: "Sign in" }).click();
      await expect(formAlert(strangerPage)).toBeVisible();
      await stranger.close();
    } finally {
      // Put it back to what it was, whatever happened above.
      if (held !== original) {
        await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);
        await submitChange(page, held, original);
        await expect(page.getByText("Password changed")).toBeVisible({ timeout: 15_000 });
        held = original;
      }
    }
  });

  test("a wrong current password is refused and nothing changes", async () => {
    await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

    await submitChange(page, "not-the-current-password", "some-other-password");

    await expect(formAlert(page)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  test("a new password that does not match its confirmation is not sent", async () => {
    await submitChange(page, "whatever-it-is", "first-new-password", "second-new-password");

    await expect(formAlert(page)).toHaveText(/do not match/);
  });

  test("the settings tab stays lit on the account page", async () => {
    await page.goto("/settings/account");

    await expect(
      page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", {
        name: "Account",
      }),
    ).toHaveAttribute("aria-current", "page");
  });
});
