/**
 * The shape of what people type into the two-factor boxes.
 *
 * Kept apart from the components so it can be tested: authenticator apps show a
 * code as "123 456", and a person copying one brings the space with them.
 */

/** A TOTP code is six digits. The plugin's default; the issuer app shows the same. */
export const TOTP_CODE_LENGTH = 6;

/** Drops the spaces and dashes an authenticator app or a printout puts in a code. */
export function normaliseTotpCode(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function isTotpCode(input: string): boolean {
  return new RegExp(`^\\d{${TOTP_CODE_LENGTH}}$`).test(normaliseTotpCode(input));
}

/**
 * A backup code as the server issued it: ten characters with a dash in the
 * middle, `abcde-fghij`. Case matters and is left alone; only the whitespace a
 * paste brings along is trimmed.
 */
export function normaliseBackupCode(input: string): string {
  return input.trim();
}

/**
 * The shared secret out of an `otpauth://` URI, for people who cannot scan.
 *
 * @returns the base32 secret, or `null` if the URI does not carry one.
 */
export function secretFromTotpUri(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

/** Splits a secret into groups of four so it can be read out and typed. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
