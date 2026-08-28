import { test, expect } from "@playwright/test";

import { STORAGE_STATE } from "./support";

/**
 * The export, end to end.
 *
 * Feature 17 was built so that things like this could be asserted at all: an
 * endpoint whose whole output is a downloaded file has no rendered page to
 * inspect, and the parts most worth checking — the status for a stranger, the
 * headers, the header row — are exactly what a unit test of the CSV helpers
 * cannot see.
 */

test.describe("signed out", () => {
  test.use({ storageState: undefined });

  test("the export is not reachable without a session", async ({ page }) => {
    // The single most valuable assertion in this file. Every other endpoint
    // leaks one page at a time; this one hands over the entire ledger, so a
    // missing scope check here is a different order of mistake.
    //
    // `maxRedirects: 0`, because following the redirect lands on the sign-in
    // page and *that* answers 200 — so a naive status check on the final
    // response passes whether the endpoint is guarded or not.
    const response = await page.request.get("/api/export", { maxRedirects: 0 });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"]).toContain("/sign-in");
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
  });
});

test.describe("signed in", () => {
  test.use({ storageState: STORAGE_STATE });

  test("serves a CSV, named and marked as a download", async ({ page }) => {
    const response = await page.request.get("/api/export");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");

    // Named from the space and the date, by the server. If this regresses the
    // browser saves something called `export` with no extension.
    expect(response.headers()["content-disposition"]).toMatch(
      /attachment; filename="financeflow-.*-\d{4}-\d{2}-\d{2}\.csv"/,
    );

    // It is the ledger. A shared cache holding it, or the browser handing it
    // to whoever is next on the machine, is the failure worth guarding.
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("carries the header row, both amounts included", async ({ page }) => {
    const body = await (await page.request.get("/api/export")).text();

    // The BOM is what makes Excel read it as UTF-8 rather than the system
    // codepage, which is how "Café" becomes "CafÃ©".
    expect(body.startsWith("\ufeff")).toBe(true);

    const header = body.replace("\ufeff", "").split("\r\n")[0];

    // `Space` is here because a personal export is no longer one space's rows:
    // it carries the owner's shared-space expenses too, since that is money out
    // of the same pocket. Without the column those rows are indistinguishable
    // from the personal ones once the file is open.
    expect(header).toBe(
      "Date,Type,Space,Description,Category,Amount,Currency,Exchange rate,Amount (base),Base currency,Entered by",
    );
  });

  test("the browser actually downloads it from the settings page", async ({ page }) => {
    await page.goto("/settings/space");

    const download = page.waitForEvent("download");

    await page.getByRole("link", { name: "Download CSV" }).click();

    // The link is a plain `<a href>` with no `download` attribute on purpose,
    // so this is also the assertion that `Content-Disposition` is what makes
    // the browser save rather than navigate.
    expect((await download).suggestedFilename()).toMatch(/^financeflow-.*\.csv$/);
  });
});
