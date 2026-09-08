"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether this render is happening after hydration.
 *
 * Read through `useSyncExternalStore` rather than set from an effect, the same
 * call `useMobilePlatform` and `OfflineBanner` make: there is nothing to
 * subscribe to — a page does not un-hydrate — so `subscribe` is a no-op, but
 * the *pair* of snapshots is the point. The server snapshot is `false`; the
 * client snapshot is `true`. React treats that disagreement as the expected
 * post-hydration swap this hook exists to produce, rather than warning about
 * it the way it would over a mismatched first render, and it keeps
 * `react-hooks/set-state-in-effect` satisfied.
 */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeSwitcher() {
  // `theme` is undefined on the server and on the client's first render —
  // next-themes only knows it after reading localStorage. Rendering the
  // icon/title from `theme` before `mounted` flips would have the server and
  // the client disagree on which one they're looking at, which is exactly the
  // mismatch this guards against: not "theme unknown", but "client's later
  // answer differs from what was already painted".
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme((prevState) => (prevState === "light" ? "dark" : "light"));
  }, [setTheme]);

  // Same size and position as the real button, so mounting doesn't shift the
  // topbar — there is just nothing theme-dependent in it yet to disagree
  // about.
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled className="rounded-full">
        <span className="h-5 w-5" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="rounded-full"
    >
      {theme === "light" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
