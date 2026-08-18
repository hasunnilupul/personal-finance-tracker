import { describe, expect, it } from "vitest";

import { SPLASH_SESSION_KEY, splashGateScript } from "@/lib/pwa/splash";

/**
 * The gate is a string of source that runs in `<head>` before the first paint,
 * so it is executed here rather than pattern-matched. A test that only checked
 * the script *mentioned* `sessionStorage` would pass against a script that
 * threw on the first line.
 */

interface FakeDocument {
  documentElement: { dataset: Record<string, string> };
}

/** Runs the gate against a stubbed document and storage, as `<head>` would. */
function runGate(storage: Partial<Storage>): FakeDocument["documentElement"]["dataset"] {
  const document: FakeDocument = { documentElement: { dataset: {} } };

  new Function("document", "sessionStorage", splashGateScript())(document, storage);

  return document.documentElement.dataset;
}

/** A `sessionStorage` that works, backed by a plain object. */
function workingStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };

  return {
    storage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    } as Partial<Storage>,
    read: () => store,
  };
}

describe("splashGateScript", () => {
  it("lets the splash play on a cold start, and records that it did", () => {
    const { storage, read } = workingStorage();

    const dataset = runGate(storage);

    // Nothing marked, so the stylesheet leaves the splash visible.
    expect(dataset.splash).toBeUndefined();
    expect(read()[SPLASH_SESSION_KEY]).toBe("1");
  });

  it("hides it for the rest of the session", () => {
    // A reload, or a client navigation that re-rendered the document. The app
    // was not launched again, so this is not a launch screen moment.
    const { storage } = workingStorage({ [SPLASH_SESSION_KEY]: "1" });

    expect(runGate(storage).splash).toBe("done");
  });

  it("plays the splash when storage throws, rather than taking the document down", () => {
    // Safari's private mode and a blocked-cookies setting both raise on
    // access. This runs in `<head>` before anything else on the page, so an
    // uncaught throw here is not a splash bug — it is a blank document.
    const throwing: Partial<Storage> = {
      getItem: () => {
        throw new Error("SecurityError: sessionStorage is not available");
      },
      setItem: () => {
        throw new Error("SecurityError: sessionStorage is not available");
      },
    };

    let dataset: Record<string, string> = {};

    expect(() => {
      dataset = runGate(throwing);
    }).not.toThrow();

    // And it fails towards showing the splash. Marking it done on a failure
    // would mean nobody ever sees the launch screen, silently.
    expect(dataset.splash).toBeUndefined();
  });

  it("never marks the document done without having read a stored flag", () => {
    // The failure that has no symptom: a gate that marked every first visit
    // done would look exactly like a splash nobody had got round to noticing.
    const { storage } = workingStorage();

    expect(runGate(storage).splash).toBeUndefined();
  });
});
