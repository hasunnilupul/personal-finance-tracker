/**
 * The app's public base URL, without a trailing slash.
 *
 * Invitation links are generated server-side and land in someone else's inbox,
 * so they cannot be relative. `BETTER_AUTH_URL` is already the app's canonical
 * origin, and falling back to localhost keeps development working.
 */
export function getAppUrl(): string {
  const url = process.env.BETTER_AUTH_URL || "http://localhost:3000";

  return url.replace(/\/+$/, "");
}

/**
 * The absolute URL someone follows to accept an invitation.
 */
export function buildInvitationUrl(invitationId: string): string {
  return `${getAppUrl()}/accept-invitation/${invitationId}`;
}
