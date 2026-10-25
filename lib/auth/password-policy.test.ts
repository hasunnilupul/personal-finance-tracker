import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from "@/lib/auth/password-policy";

describe("validateNewPassword", () => {
  const ok = "x".repeat(MIN_PASSWORD_LENGTH);

  it("accepts a matching password of acceptable length", () => {
    expect(validateNewPassword(ok, ok)).toBeNull();
  });

  it("accepts both ends of the allowed range", () => {
    const longest = "x".repeat(MAX_PASSWORD_LENGTH);

    expect(validateNewPassword(ok, ok)).toBeNull();
    expect(validateNewPassword(longest, longest)).toBeNull();
  });

  it("refuses one character short of the minimum", () => {
    const short = "x".repeat(MIN_PASSWORD_LENGTH - 1);

    expect(validateNewPassword(short, short)).toMatch(/at least/);
  });

  it("refuses one character past the maximum", () => {
    const long = "x".repeat(MAX_PASSWORD_LENGTH + 1);

    expect(validateNewPassword(long, long)).toMatch(/at most/);
  });

  it("refuses a confirmation that differs", () => {
    expect(validateNewPassword(ok, `${ok}!`)).toMatch(/do not match/);
  });

  it("checks length before the match, so a short typo is told it is short", () => {
    expect(validateNewPassword("abc", "abd")).toMatch(/at least/);
  });
});
