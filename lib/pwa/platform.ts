/**
 * Which mobile platform is looking at the page.
 *
 * This exists because iOS and Android disagree about what a bottom bar should
 * look like — Apple's tab bar and Android's navigation bar have different
 * heights, label rules and pressed states — and the app now ships one of each.
 * Deciding which needs a name that both the navigation and the install hint can
 * import, rather than a second copy of the same user-agent test.
 *
 * **It is a user-agent sniff, and that is deliberate.** There is no feature to
 * detect: the question is not what the browser can do but which platform's
 * conventions its owner expects, and nothing but the user agent answers that. A
 * wrong answer costs the wrong bar, not a broken page, so it fails towards
 * `"android"` — the bar this app has always shipped.
 */
export type MobilePlatform = "ios" | "android";

/**
 * Whether this is an Apple mobile device.
 *
 * iPadOS 13+ claims to be a Mac, so touch points are the tell: a real Mac
 * reports `maxTouchPoints` of 0 or 1, an iPad reports 5. Every iOS browser is
 * WebKit underneath, so Chrome and Firefox on an iPhone are iOS too — which is
 * right, since the platform's conventions are what is being matched.
 */
export function isIos(navigator: Navigator): boolean {
  const ua = navigator.userAgent;

  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * The platform whose navigation conventions to follow.
 *
 * Everything that is not iOS is `"android"`, including a desktop browser. That
 * is not a claim about the device — it is the fallback, and on desktop it costs
 * nothing, because the bar it selects is `md:hidden` and the sidebar is what
 * renders instead.
 */
export function detectMobilePlatform(navigator: Navigator): MobilePlatform {
  return isIos(navigator) ? "ios" : "android";
}
