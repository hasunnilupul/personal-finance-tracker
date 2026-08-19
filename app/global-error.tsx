"use client";

import { errorDigest } from "@/lib/errors/error-presentation";

/**
 * The root layout itself failed, so there is no application left to render in.
 *
 * This file replaces the root layout when it is active, which is why it carries
 * its own `<html>` and `<body>`. Everything the app normally supplies is gone
 * with the layout: the theme provider, the font, the toaster, the PWA
 * registration.
 *
 * **Deliberately built out of nothing.** No `Card`, no `Button`, no icon set,
 * no design tokens — the markup is plain elements and the colours are inline.
 * Every import this file takes is another thing that can be broken by whatever
 * broke the root layout, and a `global-error.tsx` that throws while rendering
 * leaves the reader with Next's built-in default and no way back. Consistency
 * with the rest of the app is worth less here than being unable to fail.
 *
 * That is also why the palette is inline rather than from `globals.css`: the
 * app's dark mode is a `.dark` class written onto `<html>` by the theme
 * provider, which no longer exists at this point. Deriving it again would mean
 * a blocking script reading `localStorage` — more machinery on the one path
 * that must always work. The colours below read correctly in either scheme
 * instead, being near-black on near-white.
 *
 * Not reachable in development the way the other boundaries are: Next shows its
 * error overlay first. It renders in production builds.
 */
const GlobalError = ({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) => {
  const digest = errorDigest(error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#f6f7f7",
          color: "#161b1d",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          lineHeight: 1.5,
        }}
      >
        <main role="alert" style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            FinanceFlow could not start
          </h1>

          <p style={{ fontSize: "0.875rem", margin: "0.75rem 0 0", color: "#4c5457" }}>
            Something failed before the app could load. Nothing you have recorded is affected.
          </p>

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#f6f7f7",
              backgroundColor: "#161b1d",
              border: "1px solid #161b1d",
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          {digest && (
            <p style={{ fontSize: "0.75rem", margin: "1.5rem 0 0", color: "#4c5457" }}>
              Reference: {digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
