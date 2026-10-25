import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { test, expect, type Browser, type Page } from "@playwright/test";

import { totp } from "./totp";

/**
 * Two-step verification, from turning it on to signing in with it to turning it off.
 *
 * **Its own account, for the reason `account-security.spec.ts` gives**, and with
 * the same rate limit to respect: sign-in, sign-up and every `/two-factor/*`
 * call are held to three per ten seconds on the production build the suite runs.
 * So the steps are serial, share a page, and wait out the window between sign-ins.
 *
 * **It must leave the account with two-step verification off.** An account that
 * keeps it on cannot be signed into by the next run without the secret, so the
 * secret is written to `e2e/.auth/` (git-ignored, like the saved session) the
 * moment it is read, and a run that finds the account challenged uses it to get
 * in and switch the thing off before doing anything else.
 */
test.use({ storageState: undefined });

test.describe.configure({ mode: "serial" });

const EMAIL = "e2e-twofactor@financeflow.test";
const PASSWORD = "e2e-twofactor-password";
const SECRET_FILE = path.join(__dirname, ".auth", "two-factor-secret.txt");

/** The rate limit's window, plus a little. */
const RATE_LIMIT_WINDOW_MS = 10_500;

type Outcome = "in" | "challenge" | "refused";

async function signInWith(page: Page): Promise<Outcome> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  const challenge = page.getByRole("heading", { name: "Two-step verification" });
  const refused = page.locator("form p[role='alert']");

  const outcome = await Promise.race([
    page
      .waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 })
      .then((): Outcome => "in"),
    challenge.waitFor({ timeout: 15_000 }).then((): Outcome => "challenge"),
    refused.waitFor({ timeout: 15_000 }).then((): Outcome => "refused"),
  ]).catch((): Outcome => "refused");

  return outcome;
}

async function submitCode(page: Page, code: string) {
  await page.getByLabel(/Authentication code|Backup code/).fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
}

async function openAccountSettings(page: Page) {
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "Two-step verification" })).toBeVisible();
}

async function confirmPassword(page: Page, submit: string) {
  await page.getByLabel(/Confirm your password/).fill(PASSWORD);
  await page.getByRole("button", { name: submit }).click();
}

async function turnOff(page: Page) {
  await openAccountSettings(page);

  if (!(await page.getByText("On", { exact: true }).isVisible())) {
    return;
  }

  await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);
  await page.getByRole("button", { name: "Turn off" }).click();
  await confirmPassword(page, "Turn off");
  await expect(page.getByRole("button", { name: "Turn on" })).toBeVisible({ timeout: 15_000 });

  rmSync(SECRET_FILE, { force: true });
}

/** A browser with no cookies, signed in or challenged as the account now stands. */
async function stranger(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  return { page, close: () => context.close() };
}

test.describe("two-step verification", () => {
  test.setTimeout(180_000);

  let page: Page;
  let secret = "";
  let backupCodes: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();

    let outcome = await signInWith(page);

    if (outcome === "challenge") {
      // A previous run was interrupted with it switched on.
      if (!existsSync(SECRET_FILE)) {
        throw new Error(
          `${EMAIL} has two-step verification on and the suite has no record of its secret. ` +
            "Switch it off from a browser, or delete the account from the development database.",
        );
      }

      await submitCode(page, totp(readFileSync(SECRET_FILE, "utf8").trim()));
      await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 });
      outcome = "in";
    }

    if (outcome === "refused") {
      // No account yet. Let the limit reset: a refused sign-in still counted.
      await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);
      await page.goto("/sign-up");
      await page.getByLabel("Name").fill("Two Factor Test");
      await page.getByLabel("Email").fill(EMAIL);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/sign-up"), { timeout: 20_000 });
    }

    await turnOff(page);
  });

  test.afterAll(async () => {
    try {
      await turnOff(page);
    } finally {
      await page.context().close();
    }
  });

  test("a wrong code does not turn it on, a right one does and hands over backup codes", async () => {
    await openAccountSettings(page);

    await page.getByRole("button", { name: "Turn on" }).click();
    await confirmPassword(page, "Continue");

    await expect(page.getByRole("img", { name: "Authenticator setup code" })).toBeVisible({
      timeout: 15_000,
    });

    secret = ((await page.getByTestId("two-factor-setup-key").textContent()) ?? "").replace(
      /\s/g,
      "",
    );

    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

    mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    writeFileSync(SECRET_FILE, secret);

    // Until a code is right the account is not asked for one at sign-in, so a
    // wrong one must leave it exactly as it was.
    await page.getByLabel("Code from the app").fill("000000");
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.locator("form p[role='alert']")).toBeVisible({ timeout: 15_000 });

    await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

    await page.getByLabel("Code from the app").fill(totp(secret));
    await page.getByRole("button", { name: "Turn on" }).click();

    await expect(page.getByText("Save your backup codes")).toBeVisible({ timeout: 15_000 });

    backupCodes = await page
      .getByRole("list", { name: "Backup codes" })
      .getByRole("listitem")
      .allTextContents();

    expect(backupCodes).toHaveLength(10);
    expect(backupCodes[0]).toMatch(/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/);

    await page.getByRole("button", { name: "I have saved them" }).click();
    await expect(page.getByText("On", { exact: true })).toBeVisible();
  });

  test("signing in now stops for a code, refuses a wrong one and accepts the app's", async ({
    browser,
  }) => {
    await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

    const visitor = await stranger(browser);

    try {
      expect(await signInWith(visitor.page)).toBe("challenge");

      // Still on the sign-in page, and not signed in: the password alone got no
      // further than the question.
      await expect(visitor.page).toHaveURL(/\/sign-in/);

      await submitCode(visitor.page, "000000");
      await expect(visitor.page.locator("form p[role='alert']")).toBeVisible({ timeout: 15_000 });

      await visitor.page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

      await submitCode(visitor.page, totp(secret));
      await visitor.page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
        timeout: 15_000,
      });
    } finally {
      await visitor.close();
    }
  });

  test("a backup code gets in once and not twice", async ({ browser }) => {
    const [code] = backupCodes;

    for (const expected of ["in", "refused"] as const) {
      await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

      const visitor = await stranger(browser);

      try {
        expect(await signInWith(visitor.page)).toBe("challenge");

        await visitor.page.getByRole("button", { name: "Use a backup code" }).click();
        await submitCode(visitor.page, code);

        if (expected === "in") {
          await visitor.page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
            timeout: 15_000,
          });
        } else {
          await expect(visitor.page.locator("form p[role='alert']")).toBeVisible({
            timeout: 15_000,
          });
          await expect(visitor.page).toHaveURL(/\/sign-in/);
        }
      } finally {
        await visitor.close();
      }
    }
  });

  test("turning it off asks for the password and puts sign-in back to one step", async ({
    browser,
  }) => {
    await turnOff(page);

    await page.waitForTimeout(RATE_LIMIT_WINDOW_MS);

    const visitor = await stranger(browser);

    try {
      expect(await signInWith(visitor.page)).toBe("in");
    } finally {
      await visitor.close();
    }
  });
});
