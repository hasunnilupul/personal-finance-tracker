import { describe, expect, it } from "vitest";

import { errorDigest, visibleErrorDetail } from "@/lib/errors/error-presentation";

/**
 * The tests lean on the production direction on purpose.
 *
 * A boundary that shows too little is a worse debugging experience; a boundary
 * that shows too much hands a reader the internals of a failed query, and does
 * it silently. Only one of those is worth weighting a suite towards, and it is
 * the same reasoning the splash-gate tests are written with: assert the
 * refusal, not just the happy path.
 */

describe("visibleErrorDetail", () => {
  it("never returns a message in production, wherever the error came from", () => {
    // The Server Component case is already redacted by Next before it gets
    // here. The Client Component case is not, and is the one that matters:
    // this message would otherwise have gone straight onto the screen.
    expect(
      visibleErrorDetail({ message: 'insert into "expenses" failed: 42.50 / org_abc' }, false),
    ).toBeNull();

    expect(
      visibleErrorDetail({ message: "Something went wrong", digest: "1234" }, false),
    ).toBeNull();
  });

  it("returns the message in development, where a developer is reading it", () => {
    expect(visibleErrorDetail({ message: "connect ECONNREFUSED" }, true)).toBe(
      "connect ECONNREFUSED",
    );
  });

  it("treats a blank or missing message as nothing to show", () => {
    // An empty row under the heading reads as a truncated sentence rather than
    // as an error with no detail, so the boundary needs to know to omit it.
    expect(visibleErrorDetail({ message: "   " }, true)).toBeNull();
    expect(visibleErrorDetail({}, true)).toBeNull();
    expect(visibleErrorDetail(undefined, true)).toBeNull();
    expect(visibleErrorDetail(null, true)).toBeNull();
  });

  it("does not trust the message to be a string", () => {
    // `error` crosses a serialization boundary before it reaches the boundary
    // component, and this file is the last thing standing between whatever
    // arrives and the screen.
    expect(visibleErrorDetail({ message: 42 } as never, true)).toBeNull();
  });
});

describe("errorDigest", () => {
  it("returns the digest, which is safe in production", () => {
    // The whole point of the digest: quotable by the reader, matchable in the
    // server logs, and carrying nothing about what actually failed.
    expect(errorDigest({ message: "redacted", digest: "3924871523" })).toBe("3924871523");
  });

  it("returns null when there is no digest to quote", () => {
    // A client-side throw never had a server log to match, so there is nothing
    // to print — an empty "Reference:" row would invite somebody to report it.
    expect(errorDigest({ message: "boom" })).toBeNull();
    expect(errorDigest({ digest: "  " })).toBeNull();
    expect(errorDigest(undefined)).toBeNull();
    expect(errorDigest({ digest: 99 } as never)).toBeNull();
  });
});
