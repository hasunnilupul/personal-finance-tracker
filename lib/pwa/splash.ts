/**
 * Whether the launch screen has already played in this browsing session.
 *
 * A splash is for a **cold start** — the app being opened. Replaying it on
 * every document load would put a second and a half in front of somebody who
 * merely reloaded, which is the opposite of feeling like an app.
 * `sessionStorage` is the right scope almost by accident: it ends when the tab
 * or the installed app is closed, which is exactly when the next launch is a
 * real launch.
 *
 * The check has to happen **before the first paint**, or the splash is on
 * screen before JavaScript can decide it should not be — so this is a
 * synchronous inline script rather than an effect. The same technique the
 * theme provider uses to avoid a flash of the wrong palette, and for the same
 * reason.
 *
 * It is rendered as the **first child of `<body>`**, not inside a `<head>` of
 * the layout's own. A synchronous script blocks the parser where it stands, so
 * either position runs ahead of the splash markup; but Next owns `<head>` in
 * the App Router, and a hand-written one made React re-create its children on
 * the client — which logged "Encountered a script tag while rendering React
 * component" on every load and swapped a `<div>` in for this script.
 */

/** Where the "already launched" flag lives. */
export const SPLASH_SESSION_KEY = "financeflow:splash-shown";

/**
 * The gate, as source for an inline `<script>`.
 *
 * Marks `<html data-splash="done">` when this session has already seen the
 * splash; the stylesheet hides it on that attribute alone, so no JavaScript
 * runs on the path where the splash *does* show.
 *
 * **Wrapped in `try`/`catch` because `sessionStorage` can throw** rather than
 * merely being empty — Safari's private mode and a blocked-cookies setting
 * both raise on access. An uncaught throw here runs in `<head>` before
 * anything else, and it must not be able to take the document with it.
 *
 * Failing means the splash plays. That is the deliberate direction: the
 * failure costs a repeated animation, where marking it done by mistake would
 * mean nobody ever sees the launch screen at all and nothing would ever say so.
 */
export function splashGateScript(): string {
  return `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_SESSION_KEY)})){document.documentElement.dataset.splash="done"}else{sessionStorage.setItem(${JSON.stringify(SPLASH_SESSION_KEY)},"1")}}catch(e){}`;
}
