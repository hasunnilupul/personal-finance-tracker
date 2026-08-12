import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

/**
 * Session shape returned by better-auth, including the signed-in user.
 */
export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * Authenticated user attached to a session.
 */
export type SessionUser = Session["user"];

/**
 * Reads the current session from the request cookies.
 *
 * Memoized with React `cache` so that a single render pass — layout, page
 * and any nested Server Component — hits the session store only once.
 *
 * @returns The session, or `null` when the request is anonymous.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

/**
 * Reads the signed-in user, if any.
 *
 * Prefer {@link requireUser} inside anything that must not run anonymously.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();

  return session?.user ?? null;
});

/**
 * Guarantees an authenticated user, redirecting to sign-in when there is none.
 *
 * This is the single authorization entry point for Server Components and
 * Server Actions. `proxy.ts` only performs an optimistic check, so every
 * data access must still call this — never trust the proxy alone.
 *
 * @example
 * ```ts
 * const user = await requireUser();
 * const expenses = await expenseService.getAllExpenses(user.id);
 * ```
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
