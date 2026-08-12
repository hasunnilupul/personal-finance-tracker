import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { spaceService } from "@/lib/services/space.service";
import { PermissionRequest, roleHasPermission } from "@/lib/auth/permissions";
import { Organization, Space } from "@/lib/db/models/organization.model";
import { SpaceContext } from "@/lib/services/types";
import { ServiceError } from "@/lib/services/errors";

/**
 * Session shape returned by better-auth, including the signed-in user.
 */
export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * Authenticated user attached to a session.
 */
export type SessionUser = Session["user"];

/**
 * The space a request is acting on, the caller's role in it, and the context
 * to hand to services.
 */
export interface ActiveSpace {
  space: Organization;
  role: string;
  ctx: SpaceContext;
}

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
 * const { ctx } = await requireActiveSpace();
 * const expenses = await expenseService.getAllExpenses(ctx);
 * ```
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

/**
 * Resolves the space the request is acting on.
 *
 * The session's `activeOrganizationId` is treated as a hint, not as proof:
 * membership is re-checked against the database on every call, so a stale or
 * tampered value falls back to the caller's personal space rather than
 * exposing someone else's data.
 *
 * Memoized per render pass.
 */
export const requireActiveSpace = cache(async (): Promise<ActiveSpace> => {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const { space, role } = await spaceService.resolveActiveSpace(
    session.user.id,
    session.session.activeOrganizationId,
  );

  return {
    space,
    role,
    ctx: {
      organizationId: space.id,
      userId: session.user.id,
    },
  };
});

/**
 * Every space the signed-in user belongs to, for the space switcher.
 */
export const listSpaces = cache(async (): Promise<Space[]> => {
  const user = await requireUser();

  return spaceService.listSpaces(user.id);
});

/**
 * Asserts the caller's role in the active space permits an action.
 *
 * Call this at the top of any Server Action that mutates data. Hiding a
 * button is presentation; this is the check that actually holds.
 *
 * @throws {ServiceError} `FORBIDDEN` when the role does not allow it.
 *
 * @example
 * ```ts
 * const { ctx } = await requirePermission({ transaction: ["create"] });
 * ```
 */
export async function requirePermission(request: PermissionRequest): Promise<ActiveSpace> {
  const active = await requireActiveSpace();

  if (!roleHasPermission(active.role, request)) {
    throw new ServiceError("FORBIDDEN", "You do not have permission to do that in this space.");
  }

  return active;
}
