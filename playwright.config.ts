import { defineConfig, devices } from "@playwright/test";

/**
 * The browser suite, and why it exists at all.
 *
 * Four checks — `typecheck`, `lint`, `test`, `build` — passed against every
 * defect actually found in the week of 2026-08-19: a hand-written `<head>` that
 * made React substitute a `<div>` for the splash gate script, a mark that
 * rendered at 1905px when the stylesheet did not land, and a notice that was
 * correct and unreachable. None of them exist anywhere but a rendered page.
 *
 * **It runs against a production build, not `next dev`.** Two of those three
 * were build-shaped: how a script is emitted, and which stylesheet arrives.
 * Testing the dev server would have missed them and reported success.
 *
 * Port 3100 rather than 3001, so a run never collides with the dev server the
 * repo owner has open — `reuseExistingServer` would otherwise hand the suite a
 * dev build and it would pass for the wrong reason.
 */

/** Its own port, so a run and `pnpm dev` can never be confused for each other. */
const PORT = 3100;

const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // A failure that only happens sometimes is a failure. `forbidOnly` keeps a
  // stray `test.only` from silently reducing the suite to one case.
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",

    // The machine's own Chrome, deliberately, and set here rather than on the
    // browser project so the `setup` project gets it too — a project without
    // it falls back to Playwright's bundled headless shell, which is not
    // installed and fails before a single test runs.
    channel: "chrome",
  },

  projects: [
    // Signs up (or signs in) the suite's own account once and saves the cookie
    // jar, so the signed-in tests do not each pay for a round trip through the
    // auth stack. See `e2e/auth.setup.ts`.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        // Playwright's bundled Chromium is a large download, there is no CI
        // here that would need a pinned one, and the app is a PWA worth
        // exercising in the browser people actually install it in. The channel
        // itself is set above, for every project.
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],

  webServer: {
    // `build` then `start`. The suite is worthless against `next dev`, so this
    // deliberately pays the build cost rather than offering a faster lie.
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: BASE_URL,
    // Never reuse: a server already on this port is of unknown provenance, and
    // the whole point is knowing which build answered.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // The suite makes its own account, and sign-up is invite-only by default
      // with no invitation to hand. This opens it for the test server only —
      // it is set here, not in `.env`, so it cannot leak into `pnpm dev` or a
      // deployment.
      ALLOW_PUBLIC_SIGNUP: "true",

      // **Required, not optional.** better-auth rejects any request whose
      // origin is not this value with `INVALID_ORIGIN`, and `.env` pins it to
      // the dev port. Without this line the suite serves a perfectly good
      // build on 3100 and every sign-in fails with a message that appears only
      // in the server log. It is the same trap the gotchas record for
      // `next dev` on the wrong port, met from the other direction.
      BETTER_AUTH_URL: BASE_URL,
    },
  },
});
