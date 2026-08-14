import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // A cached service worker is how a PWA gets stuck on an old build: the
        // browser keeps serving the worker it already has, and the worker is
        // the thing that would have told it to update. So this one is never
        // cached, and is pinned to a JavaScript content type — some hosts
        // guess `text/plain` for a bare `.js` at the root, and registration
        // fails outright when they do.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
