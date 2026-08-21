import { describe, expect, it } from "vitest";

import { detectMobilePlatform, isIos } from "@/lib/pwa/platform";

/**
 * A user-agent test is the kind of thing that is wrong quietly: the app renders,
 * nothing throws, and one platform simply gets the other's bar. The two cases
 * worth pinning are the iPad, which lies about being a Mac, and the real Mac it
 * lies about — telling those apart is the whole difficulty here.
 */

/** Enough of a `Navigator` for the sniff; nothing else is read. */
function nav(userAgent: string, maxTouchPoints = 0): Navigator {
  return { userAgent, maxTouchPoints } as Navigator;
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_OS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PIXEL =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("isIos", () => {
  it("recognises an iPhone", () => {
    expect(isIos(nav(IPHONE))).toBe(true);
  });

  it("recognises an iPad, which reports itself as a Macintosh", () => {
    // iPadOS 13 dropped "iPad" from the desktop-class user agent, so the string
    // alone is indistinguishable from a Mac. Touch points are what separate
    // them — and getting this wrong means every iPad gets Android's bar.
    expect(isIos(nav(IPAD_OS, 5))).toBe(true);
  });

  it("does not mistake a Mac for an iPad", () => {
    // Same user agent as above with the touch points a trackpad reports. A Mac
    // is not iOS here: it renders the sidebar, not either bar.
    expect(isIos(nav(MAC, 0))).toBe(false);
    expect(isIos(nav(MAC, 1))).toBe(false);
  });

  it("is false for Android", () => {
    expect(isIos(nav(PIXEL, 5))).toBe(false);
  });
});

describe("detectMobilePlatform", () => {
  it("maps the platforms to their bars", () => {
    expect(detectMobilePlatform(nav(IPHONE))).toBe("ios");
    expect(detectMobilePlatform(nav(IPAD_OS, 5))).toBe("ios");
    expect(detectMobilePlatform(nav(PIXEL, 5))).toBe("android");
  });

  it("falls back to android for anything it cannot place", () => {
    // The fallback is the bar that has always shipped, so an unrecognised
    // browser gets the behaviour it had before this split existed.
    expect(detectMobilePlatform(nav(""))).toBe("android");
    expect(detectMobilePlatform(nav(MAC))).toBe("android");
  });
});
