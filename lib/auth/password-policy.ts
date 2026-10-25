/**
 * better-auth's own floor, repeated so the forms can say so before a round trip.
 * The server enforces it regardless; this only saves a request.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** better-auth's ceiling. Past it the server refuses, with a less helpful message. */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Checks a new password and its confirmation, before anything is sent.
 *
 * @returns what to tell the person, or `null` when the pair is acceptable.
 */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }

  if (password !== confirmation) {
    return "The two passwords do not match.";
  }

  return null;
}
