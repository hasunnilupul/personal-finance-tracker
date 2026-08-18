import type { NextConfig } from "next";

// Relative, not `@/`: the config is loaded before the tsconfig paths apply.
import { deploymentId } from "./lib/version/deployment";

const nextConfig: NextConfig = {
  /**
   * Stamps every build with the deployment it belongs to.
   *
   * Two things come from this, and the app uses both. Next appends `?dpl=` to
   * static asset URLs and hard-navigates when a client-side navigation crosses
   * a deployment boundary, which is version-skew protection nobody has to
   * write. And it puts `data-dpl-id` on `<html>`, which is how an open tab
   * knows which build it is running — the other half of the comparison
   * `/api/version` answers.
   *
   * Undefined outside a deployment, which turns both behaviours off. That is
   * the intended state for `next dev`: there is no deployment to be skewed
   * from. Set `NEXT_DEPLOYMENT_ID` to exercise it locally.
   */
  deploymentId: deploymentId(),

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
