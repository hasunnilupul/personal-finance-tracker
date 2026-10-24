import { describe, expect, it, vi } from "vitest";

// The module builds queries against `db`; the pattern helper needs none of it.
vi.mock("@/lib/db", () => ({ db: {} }));

const { likePattern } = await import("@/lib/repositories/transaction-query");

describe("likePattern", () => {
  it("wraps the text so it matches anywhere in the column", () => {
    expect(likePattern("coffee")).toBe("%coffee%");
  });

  // A search for "50%" must find "50%", not every row that starts with "50".
  it.each([
    ["50%", "%50\\%%"],
    ["a_b", "%a\\_b%"],
    ["back\\slash", "%back\\\\slash%"],
  ])("escapes the wildcards in %s", (search, expected) => {
    expect(likePattern(search)).toBe(expected);
  });
});
