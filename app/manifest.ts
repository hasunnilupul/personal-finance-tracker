import type { MetadataRoute } from "next";

/**
 * What a browser needs in order to install the app to a home screen.
 *
 * `start_url` is `/`, the dashboard. It resolves to sign-in when there is no
 * session, which is the right landing place for a fresh install anyway.
 *
 * The colours are the app's own tokens from `globals.css`, converted from
 * OKLCh: `background_color` is the light `--background`, which is what the
 * splash screen paints while the app boots. A manifest holds one value, so it
 * follows the light theme; `themeColor` in the root layout carries both, since
 * that one accepts a media query.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinanceFlow — Personal Finance Tracker",
    short_name: "FinanceFlow",
    description: "Track expenses, manage budgets, and analyze spending patterns with FinanceFlow",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android crops every icon to its own shape. Without a maskable entry it
      // crops the "any" icon instead, which loses the corners; with one, the
      // art sits inside the safe zone and the background fills the rest.
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
