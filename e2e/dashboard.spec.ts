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

  test("keeps the bar clear of the bottom edge", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const bar = page.getByRole("navigation");
    const lastItem = bar.getByRole("link", { name: "Budgets" });

    const gap = await lastItem.evaluate((el) => {
      const item = el.getBoundingClientRect();

      return window.innerHeight - item.bottom;
    });

    // The complaint this was built for: the icons sat on the bottom edge, under
    // the reach of a gesture bar. The figure is the bar's own bottom padding, so
    // it is asserted as a floor rather than an exact value — a later design may
    // give iOS more, and should not have to come back and edit this.
    expect(gap).toBeGreaterThanOrEqual(16);
  });

  test("gives an iPhone the iOS bar and everything else Android's", async ({ browser }) => {
    // The two designs have diverged, so `data-platform` is no longer the only
    // difference — but it stays the assertion, because it is the choice being
    // tested rather than the styling that follows from it.
    const iphone = await browser.newContext({
      storageState: STORAGE_STATE,
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });
    const iphonePage = await iphone.newPage();

    await iphonePage.goto("/");
    await expect(iphonePage.getByRole("navigation")).toHaveAttribute("data-platform", "ios");

    // Exactly one bar, not two with one hidden — a second `<nav>` would be a
    // second navigation landmark, and `getByRole` above would have failed
    // strict mode rather than passing twice.
    await expect(iphonePage.locator("nav[data-platform]")).toHaveCount(1);

    await iphone.close();

    // The default context's user agent is desktop Chrome, which is not iOS and
    // therefore takes the fallback — the bar the app has always shipped.
    const other = await browser.newContext({
      storageState: STORAGE_STATE,
      viewport: { width: 390, height: 844 },
    });
    const otherPage = await other.newPage();

    await otherPage.goto("/");
    await expect(otherPage.getByRole("navigation")).toHaveAttribute("data-platform", "android");

    await other.close();
  });

  test.describe("the iOS glass bar", () => {
    const IPHONE = {
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    };

    test("floats clear of every edge, and is really translucent", async ({ browser }) => {
      const context = await browser.newContext({ storageState: STORAGE_STATE, ...IPHONE });
      const page = await context.newPage();

      await page.goto("/");

      const bar = page.locator("nav[data-platform='ios']");
      const box = await bar.boundingBox();

      // A missing box means the bar did not render at all, which is worth a
      // sentence rather than a null-dereference three lines down.
      expect(box, "the iOS bar should be laid out on an iPhone viewport").not.toBeNull();

      const { width, height } = IPHONE.viewport;

      // A capsule, not a full-width surface. Inset on both sides and clear of
      // the bottom — the complaint the whole platform split started from.
      expect(box?.x).toBeGreaterThanOrEqual(8);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width - 8);
      expect(height - ((box?.y ?? 0) + (box?.height ?? 0))).toBeGreaterThanOrEqual(16);

      // The glass. A background that resolved opaque, or a `backdrop-filter`
      // of `none`, would still look like a bar in a screenshot — this is the
      // difference a picture cannot show.
      const glass = await bar.evaluate((el) => {
        const style = getComputedStyle(el);

        return { background: style.backgroundColor, backdrop: style.backdropFilter };
      });

      expect(glass.backdrop).toContain("blur");
      // `oklch(… / 0.62)` and friends serialise with an alpha component; a
      // solid colour would not carry one at all.
      expect(glass.background).toMatch(/0\.\d+\s*\)/);

      await context.close();
    });

    test("lays a blurred strip under the capsule", async ({ browser }) => {
      const context = await browser.newContext({ storageState: STORAGE_STATE, ...IPHONE });
      const page = await context.newPage();

      await page.goto("/");

      const scrim = page.locator(".ff-iosbar-scrim");
      const bar = page.locator("nav[data-platform='ios']");

      const scrimBox = await scrim.boundingBox();
      const barBox = await bar.boundingBox();

      expect(scrimBox, "the scrim should be laid out on an iPhone viewport").not.toBeNull();
      expect(barBox).not.toBeNull();

      // Edge to edge and down to the bottom, which is the whole point: the bar
      // is inset, so without this the page runs sharp past both its ends.
      expect(scrimBox?.x).toBe(0);
      expect(scrimBox?.width).toBe(IPHONE.viewport.width);
      expect((scrimBox?.y ?? 0) + (scrimBox?.height ?? 0)).toBe(IPHONE.viewport.height);

      // And it reaches above the capsule, so the fade finishes in open space
      // rather than at the bar's own top edge — where it would be a visible
      // line instead of a gradient.
      expect(scrimBox?.y ?? 0).toBeLessThan(barBox?.y ?? 0);

      const strip = await scrim.evaluate((el) => {
        const style = getComputedStyle(el);

        return {
          backdrop: style.backdropFilter,
          mask: style.maskImage || style.webkitMaskImage,
          pointerEvents: style.pointerEvents,
        };
      });

      // A strip that tinted without blurring would be a grey band, and one
      // without the mask would end in a hard line across the page.
      expect(strip.backdrop).toContain("blur");
      expect(strip.mask).toContain("gradient");
      // It covers the bottom of every page, so a scrim that took taps would
      // swallow them silently — the worst kind of bug to find from a report.
      expect(strip.pointerEvents).toBe("none");

      await context.close();
    });

    test("puts the pill under the tab you are actually on", async ({ browser }) => {
      const context = await browser.newContext({ storageState: STORAGE_STATE, ...IPHONE });
      const page = await context.newPage();

      const pill = page.locator(".ff-iosbar-pill");

      await page.goto("/");
      await expect(pill).toHaveCSS("--ff-index", "0");

      await page.goto("/budgets");
      // Budgets is the fourth primary tab, so index 3. The pill is one element
      // that slides rather than five that light up, which is why an index is
      // the thing worth asserting.
      await expect(pill).toHaveCSS("--ff-index", "3");

      // A page reached through "More" belongs to the last column, not to no
      // column and not to Dashboard.
      await page.goto("/reports");
      await expect(pill).toHaveCSS("--ff-index", "4");

      await context.close();
    });

    test("carries exactly one copy of the refraction filter", async ({ browser }) => {
      const context = await browser.newContext({ storageState: STORAGE_STATE, ...IPHONE });
      const page = await context.newPage();

      await page.goto("/");

      // A duplicate id would not break the picture today — `url(#…)` simply
      // resolves to the first match — which is exactly why it needs asserting.
      // It is the same trap `BrandMark`'s `gradientId` exists to avoid.
      await expect(page.locator("#ff-glass-refraction")).toHaveCount(1);

      // And it must take no layout space, or it pushes the page around from
      // inside a `position: absolute` box nobody can see.
      const box = await page.locator(".ff-iosbar-filter").boundingBox();

      expect(box?.width ?? 0).toBe(0);
      expect(box?.height ?? 0).toBe(0);

      await context.close();
    });

    test("stays off the desktop, where the sidebar is", async ({ browser }) => {
      // The trap this exists for: `.ff-iosbar` sets `display: flex`, and
      // unlayered CSS beats *every* layered rule — including Tailwind's
      // `md:hidden` utility. Written outside `@layer components` this bar
      // renders at 1280px, next to the sidebar it replaces.
      const context = await browser.newContext({
        storageState: STORAGE_STATE,
        viewport: { width: 1280, height: 900 },
        userAgent: IPHONE.userAgent,
      });
      const page = await context.newPage();

      await page.goto("/");

      await expect(page.locator("nav[data-platform='ios']")).toBeHidden();
      // The strip goes with it. A blurred band across the bottom of a desktop
      // page, with no bar in it, is the same bug wearing a different shape.
      await expect(page.locator(".ff-iosbar-scrim")).toBeHidden();
      await expect(page.locator("aside")).toBeVisible();

      await context.close();
    });
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
