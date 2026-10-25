// No "server-only" here on purpose — see lib/auth/signup-policy.ts.

/**
 * Escapes text before it goes into an HTML email body.
 *
 * Space names and display names are user-supplied, and an email client is not
 * a place to find out that they were not escaped.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
