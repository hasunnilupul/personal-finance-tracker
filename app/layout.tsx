import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import PwaProvider from "@/components/pwa-provider";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <PwaProvider />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
