import { describe, expect, it } from "vitest";

import { serviceWorkerUrl } from "@/lib/pwa/service-worker";

/**
 * The URL is the worker's identity, so getting it wrong is quiet in both
 * directions: a version that never changes leaves the worker frozen on the
 * build it first installed under, and a URL whose *path* changes would create a
 * second registration rather than updating the first — taking the push
 * subscription with it.
 */

describe("serviceWorkerUrl", () => {
  it("versions the worker by query, leaving the path alone", () => {
    const url = serviceWorkerUrl("dpl_abc123");

    expect(url).toBe("/sw.js?v=dpl_abc123");

    // The scope comes from the path. Anything that moved the worker to another
    // path would register a second worker and orphan the first, along with the
    // device's push subscription.
    expect(new URL(url, "https://example.test").pathname).toBe("/sw.js");
  });

  it("falls back to the bare path when the build has no id", () => {
    // Local development, and any host setting none of the deployment
    // variables. One worker, updated only when the file itself changes — which
    // is how it behaved before versioning.
    expect(serviceWorkerUrl(null)).toBe("/sw.js");
    expect(serviceWorkerUrl("")).toBe("/sw.js");
  });

  it("encodes an id that would otherwise change the URL's shape", () => {
    // `VERCEL_URL` is a hostname and a commit sha is hex, so neither needs
    // this today. An id carrying a `&` or a `#` and going in raw would split
    // the query or truncate it, and the worker would read back a version that
    // is not the one it was given.
    expect(serviceWorkerUrl("a&b#c")).toBe("/sw.js?v=a%26b%23c");
  });
});
