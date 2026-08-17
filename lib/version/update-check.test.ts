import { describe, expect, it } from "vitest";

import { hasNewDeployment, parseVersionResponse } from "@/lib/version/update-check";

/**
 * Both failure directions are silent, so both are asserted:
 *
 * - a missed change leaves somebody on an old build indefinitely, which is the
 *   whole thing this feature exists to stop;
 * - a false alarm asks them to reload a page they may be halfway through
 *   filling in, which is worse than saying nothing at all.
 *
 * The false alarms are the ones worth the most tests here, because they are
 * produced by ordinary conditions — being offline, an id that does not exist
 * outside a deployment — rather than by anything going wrong.
 */

describe("parseVersionResponse", () => {
  it("reads the id out of a well-formed body", () => {
    expect(parseVersionResponse({ deploymentId: "dpl_123" })).toBe("dpl_123");
  });

  it("returns null when the deployment has no id to report", () => {
    // What the endpoint sends outside a deployment — running locally, or on a
    // host that sets none of the variables.
    expect(parseVersionResponse({ deploymentId: null })).toBeNull();
    expect(parseVersionResponse({})).toBeNull();
  });

  it("returns null for anything that is not the expected shape", () => {
    // A proxy or an error page answering instead of the endpoint.
    expect(parseVersionResponse("<!doctype html>")).toBeNull();
    expect(parseVersionResponse(null)).toBeNull();
    expect(parseVersionResponse(undefined)).toBeNull();
    expect(parseVersionResponse([])).toBeNull();
    expect(parseVersionResponse({ deploymentId: 42 })).toBeNull();
    expect(parseVersionResponse({ deploymentId: "" })).toBeNull();
  });
});

describe("hasNewDeployment", () => {
  it("is true when the server is on a different build", () => {
    expect(hasNewDeployment("dpl_old", "dpl_new")).toBe(true);
  });

  it("is false while the server is on the same build", () => {
    expect(hasNewDeployment("dpl_same", "dpl_same")).toBe(false);
  });

  it("is false when either side has no id", () => {
    // No id at all is the local and self-hosted case; a null on one side alone
    // is a failed or unparseable poll. Neither is a new version.
    expect(hasNewDeployment(null, "dpl_new")).toBe(false);
    expect(hasNewDeployment("dpl_old", null)).toBe(false);
    expect(hasNewDeployment(null, null)).toBe(false);
    expect(hasNewDeployment("", "dpl_new")).toBe(false);
  });

  it("treats a rollback as a new version", () => {
    // Ids carry no order, and the point is to match whatever the server is
    // serving now — which after a rollback is the older build.
    expect(hasNewDeployment("dpl_new", "dpl_old")).toBe(true);
  });
});
