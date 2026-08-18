/**
 * What an error boundary is allowed to put on screen.
 *
 * Next redacts the `message` of an error thrown in a **Server Component**
 * before it reaches the client, replacing it with a generic sentence and a
 * `digest`. It does **not** do that for an error thrown in a Client Component:
 * that message arrives intact, and in this app a client-side throw can carry a
 * space id, an amount, or the text of a failed request.
 *
 * So the rule is not "print whatever Next gives us" — that would be safe on one
 * half of the app and a leak on the other, in a way nothing on screen would
 * distinguish. The message is for the logs. The digest is the handle, and it is
 * the only part of an error this app shows a reader in production.
 *
 * Pulled out of the boundary components and given its own tests because it is
 * exactly the kind of rule that is quiet when wrong: a boundary that leaked
 * would look completely normal, and the leak would only be visible to whoever
 * happened to trigger the error.
 */

/** The shape both `error.tsx` and `global-error.tsx` are handed. */
export interface PresentableError {
  message?: string;
  digest?: string;
}

/**
 * The error's own message, but only where a developer is the one reading it.
 *
 * `null` in production, always, whatever the error is and wherever it was
 * thrown. In development it is the difference between "something went wrong"
 * and knowing which query failed, which is worth a great deal when the boundary
 * is the only thing on screen.
 */
export function visibleErrorDetail(
  error: PresentableError | undefined | null,
  isDevelopment: boolean,
): string | null {
  if (!isDevelopment) {
    return null;
  }

  const message = error?.message;

  if (typeof message !== "string") {
    return null;
  }

  const trimmed = message.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The digest, which is safe to show anywhere.
 *
 * It is a hash Next generates precisely so a reader can quote it and have it
 * matched against the server logs. Absent for an error thrown on the client,
 * where there was never a server log to match — so this returns `null` rather
 * than an empty line, and the boundary omits the row entirely.
 */
export function errorDigest(error: PresentableError | undefined | null): string | null {
  const digest = error?.digest;

  if (typeof digest !== "string") {
    return null;
  }

  const trimmed = digest.trim();

  return trimmed.length > 0 ? trimmed : null;
}
