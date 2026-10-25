import { describe, expect, it } from "vitest";

import {
  groupSecret,
  isTotpCode,
  normaliseBackupCode,
  normaliseTotpCode,
  secretFromTotpUri,
} from "@/lib/auth/two-factor-input";

describe("normaliseTotpCode", () => {
  it("drops the space an authenticator app puts in the middle", () => {
    expect(normaliseTotpCode("123 456")).toBe("123456");
  });

  it("drops surrounding whitespace and dashes", () => {
    expect(normaliseTotpCode("  123-456\n")).toBe("123456");
  });
});

describe("isTotpCode", () => {
  it("accepts six digits, spaced or not", () => {
    expect(isTotpCode("123456")).toBe(true);
    expect(isTotpCode("123 456")).toBe(true);
  });

  it("refuses the wrong length, either side", () => {
    expect(isTotpCode("12345")).toBe(false);
    expect(isTotpCode("1234567")).toBe(false);
  });

  it("refuses anything that is not a digit", () => {
    expect(isTotpCode("12345a")).toBe(false);
    expect(isTotpCode("")).toBe(false);
  });

  it("does not take a backup code for a TOTP code", () => {
    expect(isTotpCode("abcde-fghij")).toBe(false);
  });
});

describe("normaliseBackupCode", () => {
  it("trims a paste but leaves the code, its dash and its case alone", () => {
    expect(normaliseBackupCode("  aB3dE-fG7hJ \n")).toBe("aB3dE-fG7hJ");
  });
});

describe("secretFromTotpUri", () => {
  it("reads the secret out of an otpauth URI", () => {
    expect(
      secretFromTotpUri(
        "otpauth://totp/FinanceFlow:a%40b.test?secret=JBSWY3DPEHPK3PXP&issuer=FinanceFlow",
      ),
    ).toBe("JBSWY3DPEHPK3PXP");
  });

  it("returns null when there is no secret, or no URI", () => {
    expect(secretFromTotpUri("otpauth://totp/FinanceFlow:a?issuer=FinanceFlow")).toBeNull();
    expect(secretFromTotpUri("not a uri")).toBeNull();
  });
});

describe("groupSecret", () => {
  it("groups in fours so it can be read out", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });

  it("does not leave a trailing space on a short last group", () => {
    expect(groupSecret("ABCDEF")).toBe("ABCD EF");
  });
});
