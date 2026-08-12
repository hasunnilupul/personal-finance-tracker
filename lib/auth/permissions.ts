import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc, memberAc } from "better-auth/plugins/organization/access";

/**
 * Every action that can be authorised in a space.
 *
 * The `organization`, `member`, `invitation`, `team` and `ac` resources come
 * from better-auth and drive its built-in endpoints. The finance resources are
 * ours, and are checked by `requirePermission()` in the data access layer.
 */
export const statement = {
  ...defaultStatements,
  transaction: ["create", "read", "update", "delete"],
  category: ["create", "read", "update", "delete"],
  budget: ["create", "read", "update", "delete"],
  savingsGoal: ["create", "read", "update", "delete"],
  recurringTransaction: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

const FULL_FINANCE_ACCESS = {
  transaction: ["create", "read", "update", "delete"],
  category: ["create", "read", "update", "delete"],
  budget: ["create", "read", "update", "delete"],
  savingsGoal: ["create", "read", "update", "delete"],
  recurringTransaction: ["create", "read", "update", "delete"],
} as const;

/**
 * The space creator.
 *
 * Owns everything the space contains and is the only role that can invite
 * people, change roles, or delete the space.
 */
export const owner = ac.newRole({
  ...ownerAc.statements,
  ...FULL_FINANCE_ACCESS,
});

/**
 * Someone invited into a shared space.
 *
 * Members share the ledger fully: any member may add, edit and delete any
 * entry, because a household budget is only useful if everyone can correct
 * it. Attribution is preserved through `createdBy` / `updatedBy` rather than
 * by locking rows down.
 *
 * What members cannot do is administer the space — no inviting, no removing
 * people, no deleting the space.
 */
export const member = ac.newRole({
  ...memberAc.statements,
  ...FULL_FINANCE_ACCESS,
});

/**
 * Roles as better-auth needs them, for both the server plugin and the client.
 */
export const roles = {
  owner,
  member,
} as const;

export type SpaceRole = keyof typeof roles;

/**
 * A resource/action pair, e.g. `{ transaction: ["create"] }`.
 */
export type PermissionRequest = Partial<{
  [Resource in keyof typeof statement]: (typeof statement)[Resource][number][];
}>;

/**
 * Checks a role against a permission request without touching the database.
 *
 * Used by `requirePermission()` on the server and for hiding UI a member
 * cannot act on.
 */
export function roleHasPermission(role: string, request: PermissionRequest): boolean {
  const resolved = roles[role as SpaceRole];

  if (!resolved) {
    return false;
  }

  return resolved.authorize(request).success;
}
