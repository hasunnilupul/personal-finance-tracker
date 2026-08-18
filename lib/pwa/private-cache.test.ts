import { afterEach, describe, expect, it, vi } from "vitest";

import { purgePrivateCaches } from "@/lib/pwa/private-cache";

/**
 * This is the reason offline mode is allowed to keep rendered pages — and
 * therefore balances — on the device at all. The failure modes worth a test are
 * the silent ones:
 *
 * - purging the wrong names, which leaves the previous session's ledger on disk
 *   while every screen says it signed out;
 * - taking the shell with it, which is a slower app for no gain;
 * - throwing, which would strand somebody mid-sign-out.
 *
 * The prefix is duplicated in `public/sw.js`, which cannot be imported here —
 * it is a worker script served as-is, not a module. These names are written out
 * literally on purpose: if the two copies drift, this fails.
 */

const stubCaches = (names: string[]) => {
  const deleted: string[] = [];

  vi.stubGlobal("window", {});
  vi.stubGlobal("caches", {
    keys: async () => names,
    delete: async (name: string) => {
      deleted.push(name);

      return true;
    },
  });

  return deleted;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("purgePrivateCaches", () => {
  it("deletes the page caches and leaves the shell alone", async () => {
    const deleted = stubCaches([
      "financeflow-private-v1",
      "financeflow-shell-v1",
      "some-other-app-cache",
    ]);

    await purgePrivateCaches();

    expect(deleted).toEqual(["financeflow-private-v1"]);
  });

  it("clears private caches left behind by an older worker version", async () => {
    // A device that has not run the new worker's `activate` yet still holds the
    // old cache, and it is exactly as readable as the current one. Since the
    // worker takes its version from its own URL, the suffix is now a deployment
    // id rather than a hand-bumped `v1` — a device that has been through
    // several deployments can be holding several of these at once.
    const deleted = stubCaches([
      "financeflow-private-v1",
      "financeflow-private-dpl_9fa2c1",
      "financeflow-shell-dpl_9fa2c1",
    ]);

    await purgePrivateCaches();

    expect(deleted).toEqual(["financeflow-private-v1", "financeflow-private-dpl_9fa2c1"]);
  });

  it("resolves when the Cache API refuses, rather than blocking the sign-out", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("caches", {
      keys: async () => {
        throw new Error("denied in private browsing");
      },
      delete: vi.fn(),
    });

    await expect(purgePrivateCaches()).resolves.toBeUndefined();
  });

  it("does nothing where there is no Cache API", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("caches", undefined);

    await expect(purgePrivateCaches()).resolves.toBeUndefined();
  });
});
