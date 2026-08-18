import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import PwaProvider from "@/components/pwa-provider";
import AppSplash from "@/components/app-splash";
import { splashGateScript } from "@/lib/pwa/splash";
import { SpeedInsights } from "@vercel/speed-insights/next";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FinanceFlow - Personal Finance Tracker",
  description: "Track expenses, manage budgets, and analyze spending patterns with FinanceFlow",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
  // iOS ignores the manifest. These are what give it the standalone chrome and
  // the home-screen name — `appleWebApp` also emits `mobile-web-app-capable`.
  appleWebApp: {
    capable: true,
    title: "FinanceFlow",
    statusBarStyle: "default",
  },
};

/**
 * The status bar behind the app in standalone mode.
 *
 * A manifest can hold only one `theme_color`, but this accepts a media query,
 * so each scheme gets the `--card` it actually renders — the topbar's own
 * colour, which is what sits under the status bar.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161b1d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", jetbrainsMono.variable, "font-mono")}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/*
          First child of `<body>`, and deliberately not wrapped in a `<head>`
          element. A synchronous inline script blocks the parser where it
          stands, so this runs before the parser has even reached the splash
          markup below — which is the guarantee the gate needs: a session that
          has already launched never flashes the screen again. It only ever
          *hides* the splash; the visible path runs no JavaScript at all. See
          `lib/pwa/splash.ts` for why it fails towards showing.

          A hand-written `<head>` is what the first version of this used, and
          it cost a console error on every load: React re-created its children
          on the client, warned that it never executes a script it rendered
          itself, and substituted a `<div>` for this one. Next owns `<head>`
          in the App Router. Rendering one here fights it for no gain, since
          the top of `<body>` is just as far ahead of the paint.
        */}
        <script dangerouslySetInnerHTML={{ __html: splashGateScript() }} />

        {/*
          Outside ThemeProvider and before everything, because it is painted
          from the server response rather than mounted. It dismisses itself in
          CSS — nothing here needs to run for the app to be reachable.
        */}
        <AppSplash />

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <PwaProvider />
          <Toaster />
          {/*
            Real-user Core Web Vitals, sampled from actual devices rather than
            a lab run. It reports nothing until Speed Insights is enabled for
            the project in the Vercel dashboard, and is inert outside Vercel —
            so local development and the test suite are unaffected.
          */}
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
